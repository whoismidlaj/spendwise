import type { PrismaClient, Prisma } from '@prisma/client'
import { paymentsByInstallment, resolveLoanSchedule } from './loan-schedule'
import { dateKey, monthDate, monthsInRange } from './planning'

export type ObligationSource = 'RECURRING' | 'LOAN' | 'DEBT' | 'CARD'
export type ObligationStatus = 'OVERDUE' | 'UPCOMING' | 'PAID'

export type Obligation = {
  key: string
  sourceType: ObligationSource
  sourceId: string
  // Occurrence identity: the due-date key, or the installment number for scheduled loans.
  occurrenceId: string
  installmentNumber?: number
  name: string
  category: string
  dueDate: Date
  amount: number
  principal?: number
  interest?: number
  // What the forecast sets aside; differs from amount for optional items and minimum-due cards.
  reservedAmount: number
  reserves: 'FULL' | 'MINIMUM' | 'NONE'
  isRequired: boolean
  status: ObligationStatus
  paidAt?: Date
  paidAmount?: number
  paymentAccountId?: string | null
  paymentId?: string
  accountName?: string
  actions: Array<'pay' | 'unpay'>
}

export type ObligationInput = {
  plans: any[]
  debts: any[]
  cards: any[]
  cardBills: any[]
}

const MONEY = (value: unknown) => Math.round(Number(value) * 100) / 100
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
// Loan schedule dates are stored as UTC calendar dates; show them as local noon like other occurrences.
const localNoon = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)

// Pure generator shared by the forecast and the monthly payments checklist.
export function buildObligations(input: ObligationInput, range: { from: Date; to: Date; now: Date }): Obligation[] {
  const { from, to, now } = range
  const today = startOfDay(now)
  const months = monthsInRange(from, to)
  const status = (date: Date): ObligationStatus => date < today ? 'OVERDUE' : 'UPCOMING'
  const items: Obligation[] = []

  for (const plan of input.plans) {
    if (plan.archivedAt) continue
    const paidByDate = new Map<string, any>()
    for (const occurrence of plan.payments) if (occurrence.paidAt) paidByDate.set(dateKey(new Date(occurrence.dueDate)), occurrence)
    for (const { year, month } of months) {
      const date = monthDate(year, month, plan.dueDay)
      if (date < from || date > to || dateKey(date) < dateKey(new Date(plan.startDate))) continue
      if (plan.endDate && dateKey(date) > dateKey(new Date(plan.endDate))) continue
      const paid = paidByDate.get(dateKey(date))
      if (!paid && !plan.isActive) continue
      const amount = MONEY(paid ? paid.amount : plan.amount)
      items.push({
        key: `RECURRING:${plan.id}:${dateKey(date)}`, sourceType: 'RECURRING', sourceId: plan.id, occurrenceId: dateKey(date),
        name: plan.name, category: plan.type, dueDate: date, amount,
        reservedAmount: plan.isEssential ? amount : 0, reserves: plan.isEssential ? 'FULL' : 'NONE', isRequired: plan.isEssential,
        status: paid ? 'PAID' : status(date), paidAt: paid?.paidAt ? new Date(paid.paidAt) : undefined, paidAmount: paid ? amount : undefined,
        paymentAccountId: paid?.accountId ?? undefined, paymentId: paid?.id, accountName: plan.account?.name,
        actions: [paid ? 'unpay' : 'pay'],
      })
    }
  }

  for (const debt of input.debts) {
    if (debt.direction !== 'BORROWED') continue
    const payments: any[] = (debt.payments || []).map((payment: any) => ({ ...payment, paidDate: new Date(payment.paidDate) }))
    const schedule = resolveLoanSchedule(debt)
    const category = debt.type === 'LOAN' ? 'LOAN' : 'DEBT'
    const sourceType: ObligationSource = debt.type === 'LOAN' || schedule.length ? 'LOAN' : 'DEBT'
    if (schedule.length) {
      const matched = paymentsByInstallment(schedule, payments)
      for (const installment of schedule) {
        const date = localNoon(installment.dueDate)
        if (date < from || date > to) continue
        const payment = matched.get(installment.number)
        if (!payment && !debt.isActive) continue
        items.push({
          key: `LOAN:${debt.id}:${installment.number}`, sourceType: 'LOAN', sourceId: debt.id, occurrenceId: String(installment.number), installmentNumber: installment.number,
          name: debt.name, category, dueDate: date, amount: payment ? MONEY(payment.amount) : installment.amount,
          principal: payment?.principalAmount != null ? MONEY(payment.principalAmount) : installment.principal,
          interest: payment?.interestAmount != null ? MONEY(payment.interestAmount) : installment.interest,
          reservedAmount: installment.amount, reserves: 'FULL', isRequired: true,
          status: payment ? 'PAID' : status(date), paidAt: payment?.paidDate, paidAmount: payment ? MONEY(payment.amount) : undefined,
          paymentAccountId: payment?.accountId ?? undefined, paymentId: payment?.id, actions: [payment ? 'unpay' : 'pay'],
        })
      }
    } else if (debt.isRecurring && debt.paymentDate && debt.paymentAmount) {
      for (const { year, month } of months) {
        const date = monthDate(year, month, debt.paymentDate)
        if (date < from || date > to) continue
        const payment = payments.find((item: any) => item.paidDate.getFullYear() === year && item.paidDate.getMonth() === month)
        if (!payment && !debt.isActive) continue
        const amount = payment ? MONEY(payment.amount) : Math.min(MONEY(debt.paymentAmount), MONEY(debt.remaining))
        items.push({
          key: `${sourceType}:${debt.id}:${dateKey(date)}`, sourceType, sourceId: debt.id, occurrenceId: dateKey(date),
          name: debt.name, category, dueDate: date, amount, reservedAmount: amount, reserves: 'FULL', isRequired: true,
          status: payment ? 'PAID' : status(date), paidAt: payment?.paidDate, paidAmount: payment ? amount : undefined,
          paymentAccountId: payment?.accountId ?? undefined, paymentId: payment?.id, actions: [payment ? 'unpay' : 'pay'],
        })
      }
    } else if (debt.deadline) {
      const date = new Date(debt.deadline)
      if (date > to) continue
      const settled = !debt.isActive || MONEY(debt.remaining) <= 0
      const last = [...payments].sort((a: any, b: any) => b.paidDate.getTime() - a.paidDate.getTime())[0]
      if (settled) {
        if (!last || date < from) continue
        const paidAmount = MONEY(payments.reduce((total: number, item: any) => total + Number(item.amount), 0))
        items.push({
          key: `DEBT:${debt.id}:deadline`, sourceType: 'DEBT', sourceId: debt.id, occurrenceId: 'deadline', name: debt.name, category, dueDate: date, amount: paidAmount,
          reservedAmount: 0, reserves: 'NONE', isRequired: true, status: 'PAID', paidAt: last.paidDate, paidAmount, paymentAccountId: last.accountId ?? undefined, paymentId: last.id, actions: ['unpay'],
        })
      } else {
        const amount = MONEY(debt.remaining)
        items.push({
          key: `DEBT:${debt.id}:deadline`, sourceType: 'DEBT', sourceId: debt.id, occurrenceId: 'deadline', name: debt.name, category, dueDate: date, amount,
          reservedAmount: amount, reserves: 'FULL', isRequired: true, status: status(date), actions: ['pay'],
        })
      }
    }
  }

  for (const card of input.cards) {
    const bills = input.cardBills.filter((bill: any) => bill.creditCardId === card.id)
    for (const bill of bills) {
      if (!bill.paidAt) continue
      const date = new Date(bill.dueDate)
      if (date < from || date > to) continue
      const last = [...(bill.payments || [])].sort((a: any, b: any) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime())[0]
      items.push({
        key: `CARD:${card.id}:${dateKey(date)}`, sourceType: 'CARD', sourceId: card.id, occurrenceId: dateKey(date), name: `${card.bank} ${card.name}`,
        category: card.type === 'PAYLATER' ? 'PAY_LATER' : 'CARD', dueDate: date, amount: MONEY(bill.statementAmount), reservedAmount: 0, reserves: 'NONE', isRequired: true,
        status: 'PAID', paidAt: new Date(bill.paidAt), paidAmount: MONEY(bill.paidAmount), paymentAccountId: last?.accountId ?? undefined, paymentId: last?.id, actions: last ? ['unpay'] : [],
      })
    }
    if (!card.isActive) continue
    const actualDue = Number(card.dueAmount)
    const estimatedDue = Number(card.expectedDue ?? card.usedLimit)
    const amount = MONEY(actualDue > 0 ? actualDue : estimatedDue)
    if (amount <= 0) continue
    const paidDates = new Set(bills.filter((bill: any) => bill.paidAt).map((bill: any) => dateKey(new Date(bill.dueDate))))
    const currentDueDate = monthDate(now.getFullYear(), now.getMonth(), card.dueDate)
    let date: Date = card.billDueDate ? new Date(card.billDueDate) : actualDue > 0 ? currentDueDate : (currentDueDate < today ? monthDate(now.getFullYear(), now.getMonth() + 1, card.dueDate) : currentDueDate)
    // A cycle already settled moves the remaining usage to the next statement.
    for (let guard = 0; paidDates.has(dateKey(date)) && guard < 12; guard++) date = monthDate(date.getFullYear(), date.getMonth() + 1, card.dueDate)
    if (date > to) continue
    items.push({
      key: `CARD:${card.id}:${dateKey(date)}`, sourceType: 'CARD', sourceId: card.id, occurrenceId: dateKey(date), name: `${card.bank} ${card.name}`,
      category: card.type === 'PAYLATER' ? 'PAY_LATER' : 'CARD', dueDate: date, amount,
      reservedAmount: actualDue > 0 ? MONEY(Number(card.minimumDue) || actualDue) : amount, reserves: actualDue > 0 && Number(card.minimumDue) > 0 ? 'MINIMUM' : 'FULL', isRequired: true,
      status: status(date), actions: ['pay'],
    })
  }
  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.name.localeCompare(b.name))
}

type Db = PrismaClient | Prisma.TransactionClient

export async function loadObligations(db: Db, userId: string, range: { from: Date; to: Date; now?: Date }): Promise<Obligation[]> {
  const [plans, debts, cards, cardBills] = await Promise.all([
    db.paymentPlan.findMany({ where: { userId }, include: { account: { select: { name: true } }, payments: true } }),
    db.debt.findMany({ where: { userId, direction: 'BORROWED' }, include: { payments: true } }),
    db.creditCard.findMany({ where: { userId } }),
    db.cardBill.findMany({ where: { creditCard: { userId } }, include: { payments: true } }),
  ])
  return buildObligations({ plans, debts, cards, cardBills }, { ...range, now: range.now ?? new Date() })
}

// How far back unpaid obligations are carried forward as overdue.
export const OVERDUE_LOOKBACK_MONTHS = 3
