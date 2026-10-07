import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { isSupportedCurrency } from './currency'

export const BACKUP_FORMAT = 'spendwise-backup'
export const CURRENT_BACKUP_VERSION = '3.2'

export class BackupError extends Error {
  constructor(message: string, public details: string[] = [], public status = 400) { super(message) }
}

const num = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a number')]).transform(Number).refine(Number.isFinite, 'must be a finite number')
const optNum = num.nullish().transform(value => value ?? null)
const dateString = z.string().refine(value => !Number.isNaN(Date.parse(value)), 'must be a valid date')
const optDate = dateString.nullish().transform(value => value ?? null)
const id = z.string().min(1)
const optId = z.string().nullish().transform(value => value || null)

const account = z.object({
  id, name: z.string(), type: z.enum(['BANK', 'WALLET', 'CASH']).default('BANK'), balance: num, color: z.string().default('#01696f'),
  institution: z.string().default('OTHER'), isActive: z.boolean().default(true), createdAt: optDate,
})
const creditCard = z.object({
  id, name: z.string(), bank: z.string(), institution: z.string().default('OTHER'), totalLimit: num, usedLimit: num.default(0), dueAmount: num.default(0),
  expectedDue: optNum, billDueDate: optDate, minimumDue: num.default(0), dueDate: z.number().int(), statementDate: z.number().int().default(1),
  color: z.string().default('#006494'), type: z.string().default('CARD'), isActive: z.boolean().default(true), reminderDays: z.number().int().default(3), createdAt: optDate,
})
const cardBill = z.object({ id, creditCardId: id, statementDate: optDate, dueDate: dateString, statementAmount: num, minimumDue: num.default(0), paidAmount: num.default(0), paidAt: optDate, createdAt: optDate })
const cardPayment = z.object({
  id, creditCardId: id, cardBillId: optId, amount: num, paidDate: dateString, accountId: optId, transactionId: optId,
  usedDelta: num, dueDelta: num, minimumDelta: num, expectedDelta: num, createdAt: optDate,
})
const installment = z.object({ number: z.number().int().optional(), dueDate: z.string(), amount: z.number(), principal: z.number().optional(), interest: z.number().optional(), opening: z.number().optional(), closing: z.number().optional() })
const debtPayment = z.object({
  id, amount: num, principalAmount: optNum, interestAmount: optNum, installmentNumber: z.number().int().nullish().transform(value => value ?? null),
  scheduledDueDate: optDate, transactionId: optId, paidDate: dateString, accountId: optId,
})
const debt = z.object({
  id, name: z.string(), direction: z.enum(['BORROWED', 'LENT']).default('BORROWED'), type: z.enum(['PERSONAL', 'LOAN', 'CREDIT_LINE', 'PAY_LATER']),
  amount: num, remaining: num, interestRate: num.default(0), isRecurring: z.boolean().default(false), paymentDate: z.number().int().nullish().transform(value => value ?? null),
  paymentAmount: optNum, totalInstallments: z.number().int().nullish().transform(value => value ?? null), startDate: optDate,
  totalRepaymentAmount: optNum, totalInterestAmount: optNum, installmentSchedule: z.array(installment).nullish().transform(value => value ?? null),
  deadline: optDate, priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'), description: z.string().nullish().transform(value => value ?? null),
  isActive: z.boolean().default(true), createdAt: optDate, payments: z.array(debtPayment).default([]),
})
const incomeOccurrence = z.object({ id, expectedDate: dateString, expectedAmount: num, actualAmount: optNum, receivedAt: optDate, status: z.enum(['EXPECTED', 'RECEIVED', 'SKIPPED']).default('EXPECTED'), notes: z.string().nullish().transform(value => value ?? null), createdAt: optDate })
const incomeSource = z.object({
  id, accountId: optId, name: z.string(), type: z.enum(['SALARY', 'FREELANCE', 'RENTAL', 'INTEREST', 'OTHER']).default('SALARY'), frequency: z.enum(['MONTHLY', 'WEEKLY', 'ONE_TIME']).default('MONTHLY'),
  payday: z.number().int().nullish().transform(value => value ?? null), paydayRule: z.enum(['DAY_OF_MONTH', 'LAST_WORKING_DAY']).default('DAY_OF_MONTH'), grossAmount: optNum, expectedInHand: num, defaultDeductions: num.default(0), isActive: z.boolean().default(true), createdAt: optDate,
  occurrences: z.array(incomeOccurrence).default([]),
})
const planOccurrence = z.object({ id, dueDate: dateString, amount: num, paidAt: optDate, accountId: optId, transactionId: optId, createdAt: optDate })
const paymentPlan = z.object({
  id, accountId: optId, name: z.string(), type: z.enum(['RENT', 'UTILITY', 'SUBSCRIPTION', 'INSURANCE', 'FAMILY', 'SAVINGS', 'OTHER']).default('OTHER'), amount: num, dueDay: z.number().int().min(1).max(31),
  isEssential: z.boolean().default(true), isActive: z.boolean().default(true), startDate: dateString, endDate: optDate, archivedAt: optDate, notes: z.string().nullish().transform(value => value ?? null), createdAt: optDate,
  payments: z.array(planOccurrence).default([]),
})
const ledgerEntry = z.object({
  id, accountId: optId, toAccountId: optId, creditCardId: optId, managedPayment: z.boolean().default(false), type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']), amount: num,
  name: z.string(), description: z.string().nullish().transform(value => value ?? null), date: dateString, createdAt: optDate,
})

const backupBody = z.object({
  settings: z.object({ currency: z.string().optional(), cashBuffer: num.optional() }).nullish(),
  accounts: z.array(account).default([]), creditCards: z.array(creditCard).default([]), cardBills: z.array(cardBill).default([]), cardPayments: z.array(cardPayment).default([]),
  debts: z.array(debt).default([]), incomeSources: z.array(incomeSource).default([]), paymentPlans: z.array(paymentPlan).default([]), paymentLedger: z.array(ledgerEntry).default([]),
})
export type Backup = z.infer<typeof backupBody>

export type RestoreCounts = Record<'accounts' | 'creditCards' | 'cardBills' | 'cardPayments' | 'debts' | 'debtPayments' | 'incomeSources' | 'incomeOccurrences' | 'paymentPlans' | 'paymentPlanOccurrences' | 'ledgerEntries', number>

export function countBackup(backup: Backup): RestoreCounts {
  return {
    accounts: backup.accounts.length, creditCards: backup.creditCards.length, cardBills: backup.cardBills.length, cardPayments: backup.cardPayments.length,
    debts: backup.debts.length, debtPayments: backup.debts.reduce((total, item) => total + item.payments.length, 0),
    incomeSources: backup.incomeSources.length, incomeOccurrences: backup.incomeSources.reduce((total, item) => total + item.occurrences.length, 0),
    paymentPlans: backup.paymentPlans.length, paymentPlanOccurrences: backup.paymentPlans.reduce((total, item) => total + item.payments.length, 0), ledgerEntries: backup.paymentLedger.length,
  }
}

function parseVersion(version: unknown): [number, number] | null {
  const match = typeof version === 'string' ? version.match(/^(\d+)\.(\d+)$/) : null
  return match ? [Number(match[1]), Number(match[2])] : null
}

// Pre-3.0 backups kept loans and bills in one "recurringExpenses" collection.
function convertLegacyRecurring(items: any[], notes: string[]): { debts: any[]; paymentPlans: any[] } {
  const debts: any[] = []
  const paymentPlans: any[] = []
  for (const item of items) {
    if (item.type === 'EMI' || item.type === 'LOAN') {
      const installmentCount = Number(item.totalEMIs || 0)
      const paidCount = Number(item.paidEMIs || 0)
      const originalAmount = Number(item.loanAmount || (Number(item.emiAmount) * Math.max(installmentCount, 1)))
      const remaining = installmentCount > 0 ? originalAmount * Math.max(installmentCount - paidCount, 0) / installmentCount : Math.max(originalAmount - Number(item.emiAmount) * paidCount, 0)
      const recorded = Array.isArray(item.payments) ? item.payments : []
      const payments = recorded.map((payment: any, index: number) => ({ id: payment.id ?? `${item.id}-payment-${index}`, amount: payment.amount, paidDate: payment.paidDate, accountId: item.accountId || null }))
      for (let index = recorded.length; index < paidCount; index++) {
        const paidDate = new Date(item.startDate)
        paidDate.setMonth(paidDate.getMonth() + index)
        payments.push({ id: `${item.id}-payment-${index}`, amount: item.emiAmount, paidDate: paidDate.toISOString(), accountId: item.accountId || null })
      }
      debts.push({
        id: item.id, name: item.name, direction: 'BORROWED', type: 'LOAN', amount: originalAmount, remaining: Math.round(remaining * 100) / 100, interestRate: item.interestRate || 0, isRecurring: true,
        paymentDate: item.emiDate, paymentAmount: item.emiAmount, totalInstallments: item.totalEMIs || null, startDate: item.startDate, priority: 'MEDIUM',
        description: 'Restored from the former Recurring Payments screen', isActive: item.isActive ?? true, createdAt: item.createdAt, payments,
      })
    } else {
      const seen = new Set<string>()
      const payments = (Array.isArray(item.payments) ? item.payments : []).filter((payment: any) => { const key = new Date(payment.paidDate).toISOString(); if (seen.has(key)) return false; seen.add(key); return true })
        .map((payment: any, index: number) => ({ id: payment.id ?? `${item.id}-payment-${index}`, dueDate: payment.paidDate, amount: payment.amount, paidAt: payment.paidDate, accountId: item.accountId || null }))
      paymentPlans.push({
        id: item.id, accountId: item.accountId || null, name: item.name, type: ['RENT', 'UTILITY', 'SUBSCRIPTION'].includes(item.type) ? item.type : 'OTHER', amount: item.emiAmount, dueDay: item.emiDate,
        isEssential: true, isActive: item.isActive ?? true, startDate: item.startDate, notes: 'Restored from the former Recurring Payments screen', payments,
      })
    }
  }
  notes.push(`Converted ${items.length} legacy recurring expense${items.length === 1 ? '' : 's'} into loans and recurring payments.`)
  return { debts, paymentPlans }
}

export type ParsedBackup = { backup: Backup; sourceVersion: string; warnings: string[]; notes: string[] }

// Step 1-4 of a restore: parse, reject unsupported versions, convert older shapes, validate. Never touches the database.
export function parseBackup(raw: unknown): ParsedBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BackupError('This is not a Spendwise backup file')
  const input = raw as Record<string, any>
  const warnings: string[] = []
  const notes: string[] = []
  const versioned = input.format === BACKUP_FORMAT
  let sourceVersion = 'legacy'
  if (versioned) {
    const parsedVersion = parseVersion(input.version)
    const current = parseVersion(CURRENT_BACKUP_VERSION)!
    if (!parsedVersion) throw new BackupError(`Unrecognised backup version "${String(input.version)}"`)
    if (parsedVersion[0] > current[0] || (parsedVersion[0] === current[0] && parsedVersion[1] > current[1])) {
      throw new BackupError(`This backup was made by a newer version of Spendwise (${input.version}). Update the app, then restore again.`)
    }
    if (parsedVersion[0] < 3) throw new BackupError(`Backup version ${input.version} is not supported`)
    sourceVersion = input.version
  } else if (!Array.isArray(input.accounts) || !Array.isArray(input.debts)) {
    throw new BackupError('This is not a Spendwise backup file')
  }

  const body: Record<string, any> = { ...input }
  if (!Array.isArray(body.paymentLedger) && Array.isArray(body.transactions)) { body.paymentLedger = body.transactions; notes.push('Read the internal ledger from the legacy "transactions" collection.') }
  if (versioned) {
    if (Array.isArray(input.recurringExpenses) && input.recurringExpenses.length) warnings.push('Ignored the legacy recurringExpenses collection because this backup already contains loans and recurring payments.')
    delete body.recurringExpenses
  } else if (Array.isArray(input.recurringExpenses)) {
    const converted = convertLegacyRecurring(input.recurringExpenses, notes)
    body.debts = [...(body.debts ?? []), ...converted.debts]
    body.paymentPlans = [...(body.paymentPlans ?? []), ...converted.paymentPlans]
  }
  if (!versioned) notes.push('This is an older backup format; it was converted to the current format.')
  else if (sourceVersion !== CURRENT_BACKUP_VERSION) notes.push(`Converted a version ${sourceVersion} backup to version ${CURRENT_BACKUP_VERSION}.`)

  const result = backupBody.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.slice(0, 10).map(issue => `${issue.path.join('.')}: ${issue.message}`)
    throw new BackupError('The backup file is damaged or incomplete', details)
  }
  const backup = result.data
  for (const item of backup.debts) for (const payment of item.payments) {
    // Older backups did not store the interest part of a payment.
    if (payment.interestAmount === null && payment.principalAmount !== null) payment.interestAmount = Math.round((payment.amount - payment.principalAmount) * 100) / 100
  }
  if (backup.settings?.currency && !isSupportedCurrency(backup.settings.currency)) { warnings.push(`Currency ${backup.settings.currency} is not supported; your current currency will be kept.`); backup.settings.currency = undefined }
  const nonMonthly = backup.incomeSources.filter(source => source.frequency !== 'MONTHLY').length
  if (nonMonthly) warnings.push(`${nonMonthly} income source${nonMonthly === 1 ? ' uses' : 's use'} a weekly or one-time schedule. They are restored but not included in the monthly forecast.`)

  const errors = validateBackup(backup, warnings)
  if (errors.length) throw new BackupError('The backup failed validation. Nothing was changed.', errors)
  return { backup, sourceVersion, warnings, notes }
}

const SLACK = 0.015

// Reference and financial invariants. Returns blocking errors; non-blocking findings are added to warnings.
export function validateBackup(backup: Backup, warnings: string[]): string[] {
  const errors: string[] = []
  const unique = (label: string, items: { id: string }[]) => {
    const seen = new Set<string>()
    for (const item of items) { if (seen.has(item.id)) errors.push(`Duplicate ${label} id ${item.id}`); seen.add(item.id) }
    return seen
  }
  const accountIds = unique('account', backup.accounts)
  const cardIds = unique('card', backup.creditCards)
  const billIds = unique('card bill', backup.cardBills)
  unique('debt', backup.debts); unique('income source', backup.incomeSources); unique('recurring payment', backup.paymentPlans)
  const ledgerIds = unique('ledger entry', backup.paymentLedger)
  unique('card payment', backup.cardPayments)
  unique('debt payment', backup.debts.flatMap(item => item.payments))

  for (const bill of backup.cardBills) if (!cardIds.has(bill.creditCardId)) errors.push(`Card bill ${bill.id} refers to a missing card`)
  for (const payment of backup.cardPayments) {
    if (!cardIds.has(payment.creditCardId)) errors.push(`Card payment ${payment.id} refers to a missing card`)
    if (payment.cardBillId && !billIds.has(payment.cardBillId)) errors.push(`Card payment ${payment.id} refers to a missing card bill`)
    if (payment.accountId && !accountIds.has(payment.accountId)) errors.push(`Card payment ${payment.id} refers to a missing account`)
  }
  for (const entry of backup.paymentLedger) {
    for (const [label, ref, ids] of [['account', entry.accountId, accountIds], ['destination account', entry.toAccountId, accountIds], ['card', entry.creditCardId, cardIds]] as const) {
      if (ref && !ids.has(ref)) errors.push(`Ledger entry ${entry.id} refers to a missing ${label}`)
    }
    if (entry.amount < 0) errors.push(`Ledger entry ${entry.id} has a negative amount`)
  }
  for (const source of backup.incomeSources) if (source.accountId && !accountIds.has(source.accountId)) errors.push(`Income source "${source.name}" refers to a missing account`)
  for (const plan of backup.paymentPlans) {
    if (plan.accountId && !accountIds.has(plan.accountId)) errors.push(`Recurring payment "${plan.name}" refers to a missing account`)
    const dueDates = new Set<string>()
    for (const occurrence of plan.payments) {
      const key = new Date(occurrence.dueDate).toISOString()
      if (dueDates.has(key)) errors.push(`Recurring payment "${plan.name}" has two occurrences on ${key.slice(0, 10)}`)
      dueDates.add(key)
    }
  }
  for (const item of backup.debts) {
    if (item.remaining < -SLACK || item.remaining > item.amount + SLACK) errors.push(`Loan "${item.name}": outstanding principal must be between 0 and the original principal`)
    const installments = new Set<number>()
    for (const payment of item.payments) {
      if (payment.accountId && !accountIds.has(payment.accountId)) errors.push(`Payment ${payment.id} on "${item.name}" refers to a missing account`)
      if (payment.principalAmount !== null && payment.principalAmount > payment.amount + SLACK) errors.push(`Payment ${payment.id} on "${item.name}" has more principal than the amount paid`)
      if (payment.principalAmount !== null && payment.interestAmount !== null && Math.abs(payment.principalAmount + payment.interestAmount - payment.amount) > SLACK) errors.push(`Payment ${payment.id} on "${item.name}": principal plus interest must equal the amount`)
      if (payment.installmentNumber !== null) {
        if (installments.has(payment.installmentNumber)) errors.push(`"${item.name}" has two payments for installment ${payment.installmentNumber}`)
        installments.add(payment.installmentNumber)
      }
      if (payment.transactionId && backup.paymentLedger.length && !ledgerIds.has(payment.transactionId)) {
        warnings.push(`A payment on "${item.name}" points to a ledger entry that is not in the backup; it will be restored without that link.`)
        payment.transactionId = null
      }
    }
    if (item.installmentSchedule) {
      item.installmentSchedule.forEach((row, index) => {
        if (row.number !== undefined && row.number !== index + 1) errors.push(`"${item.name}": installment numbers must run 1 to ${item.installmentSchedule!.length}`)
        if (row.principal !== undefined && row.interest !== undefined && Math.abs(row.principal + row.interest - row.amount) > SLACK) errors.push(`"${item.name}": installment ${index + 1} principal plus interest must equal its amount`)
      })
    }
  }
  return Array.from(new Set(errors)).slice(0, 25)
}

// Ids already used by another user's data are replaced consistently, so a backup can move between accounts.
export type IdConflicts = Partial<Record<'account' | 'card' | 'cardBill' | 'cardPayment' | 'debt' | 'debtPayment' | 'incomeSource' | 'incomeOccurrence' | 'paymentPlan' | 'paymentPlanOccurrence' | 'ledger', Set<string>>>

const newId = () => `c${randomBytes(12).toString('hex')}`

export function remapConflicts(backup: Backup, conflicts: IdConflicts): { backup: Backup; remapped: number } {
  const maps = new Map<string, Map<string, string>>()
  const pick = (kind: keyof IdConflicts, value: string) => {
    if (!conflicts[kind]?.has(value)) return value
    const map = maps.get(kind) ?? new Map<string, string>()
    maps.set(kind, map)
    if (!map.has(value)) map.set(value, newId())
    return map.get(value)!
  }
  const ref = (kind: keyof IdConflicts, value: string | null) => value ? pick(kind, value) : null
  const result: Backup = {
    ...backup,
    accounts: backup.accounts.map(item => ({ ...item, id: pick('account', item.id) })),
    creditCards: backup.creditCards.map(item => ({ ...item, id: pick('card', item.id) })),
    cardBills: backup.cardBills.map(item => ({ ...item, id: pick('cardBill', item.id), creditCardId: pick('card', item.creditCardId) })),
    cardPayments: backup.cardPayments.map(item => ({ ...item, id: pick('cardPayment', item.id), creditCardId: pick('card', item.creditCardId), cardBillId: ref('cardBill', item.cardBillId), accountId: ref('account', item.accountId), transactionId: ref('ledger', item.transactionId) })),
    debts: backup.debts.map(item => ({ ...item, id: pick('debt', item.id), payments: item.payments.map(payment => ({ ...payment, id: pick('debtPayment', payment.id), accountId: ref('account', payment.accountId), transactionId: ref('ledger', payment.transactionId) })) })),
    incomeSources: backup.incomeSources.map(item => ({ ...item, id: pick('incomeSource', item.id), accountId: ref('account', item.accountId), occurrences: item.occurrences.map(occurrence => ({ ...occurrence, id: pick('incomeOccurrence', occurrence.id) })) })),
    paymentPlans: backup.paymentPlans.map(item => ({ ...item, id: pick('paymentPlan', item.id), accountId: ref('account', item.accountId), payments: item.payments.map(occurrence => ({ ...occurrence, id: pick('paymentPlanOccurrence', occurrence.id), accountId: ref('account', occurrence.accountId), transactionId: ref('ledger', occurrence.transactionId) })) })),
    paymentLedger: backup.paymentLedger.map(item => ({ ...item, id: pick('ledger', item.id), accountId: ref('account', item.accountId), toAccountId: ref('account', item.toAccountId), creditCardId: ref('card', item.creditCardId) })),
  }
  return { backup: result, remapped: Array.from(maps.values()).reduce((total, map) => total + map.size, 0) }
}
