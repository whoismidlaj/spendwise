import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BackupError, countBackup, IdConflicts, parseBackup, remapConflicts } from '@/lib/backup'

const when = (value: string | null) => value ? new Date(value) : undefined

// POST /api/restore?preview=1 validates and summarises a backup without changing anything.
// POST /api/restore replaces the user's data atomically; any failure rolls everything back.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const preview = new URL(req.url).searchParams.get('preview') === '1'

  let parsed
  try {
    let raw: unknown
    try { raw = await req.json() } catch { throw new BackupError('The file is not valid JSON, or it was cut off before the end') }
    parsed = parseBackup(raw)
  } catch (error) {
    if (error instanceof BackupError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
    return NextResponse.json({ error: 'Unable to read the backup' }, { status: 400 })
  }

  if (preview) {
    const [accounts, creditCards, debts, incomeSources, paymentPlans, ledger] = await Promise.all([
      prisma.account.count({ where: { userId } }), prisma.creditCard.count({ where: { userId } }), prisma.debt.count({ where: { userId } }),
      prisma.incomeSource.count({ where: { userId } }), prisma.paymentPlan.count({ where: { userId } }), prisma.transaction.count({ where: { userId } }),
    ])
    return NextResponse.json({
      version: parsed.sourceVersion, counts: countBackup(parsed.backup), warnings: parsed.warnings, notes: parsed.notes,
      replaces: { accounts, creditCards, debts, incomeSources, paymentPlans, ledgerEntries: ledger },
    })
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const settings = parsed.backup.settings
      if (settings) {
        await tx.user.update({ where: { id: userId }, data: { ...(settings.currency && { currency: settings.currency }), ...(typeof settings.cashBuffer === 'number' && settings.cashBuffer >= 0 && { cashBuffer: settings.cashBuffer }) } })
      }
      // Clear this user's data, children before parents.
      await tx.cardPayment.deleteMany({ where: { creditCard: { userId } } })
      await tx.cardBill.deleteMany({ where: { creditCard: { userId } } })
      await tx.paymentPlanOccurrence.deleteMany({ where: { paymentPlan: { userId } } })
      await tx.paymentPlan.deleteMany({ where: { userId } })
      await tx.incomeOccurrence.deleteMany({ where: { incomeSource: { userId } } })
      await tx.incomeSource.deleteMany({ where: { userId } })
      await tx.transaction.deleteMany({ where: { userId } })
      await tx.debt.deleteMany({ where: { userId } })
      await tx.creditCard.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })

      // Any id still present belongs to someone else, so give those records fresh ids.
      const source = parsed.backup
      const existing = async (ids: string[], find: (ids: string[]) => Promise<{ id: string }[]>) => new Set((ids.length ? await find(ids) : []).map(row => row.id))
      const conflicts: IdConflicts = {
        account: await existing(source.accounts.map(item => item.id), ids => tx.account.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        card: await existing(source.creditCards.map(item => item.id), ids => tx.creditCard.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        cardBill: await existing(source.cardBills.map(item => item.id), ids => tx.cardBill.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        cardPayment: await existing(source.cardPayments.map(item => item.id), ids => tx.cardPayment.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        debt: await existing(source.debts.map(item => item.id), ids => tx.debt.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        debtPayment: await existing(source.debts.flatMap(item => item.payments.map(payment => payment.id)), ids => tx.debtPayment.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        incomeSource: await existing(source.incomeSources.map(item => item.id), ids => tx.incomeSource.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        incomeOccurrence: await existing(source.incomeSources.flatMap(item => item.occurrences.map(row => row.id)), ids => tx.incomeOccurrence.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        paymentPlan: await existing(source.paymentPlans.map(item => item.id), ids => tx.paymentPlan.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        paymentPlanOccurrence: await existing(source.paymentPlans.flatMap(item => item.payments.map(row => row.id)), ids => tx.paymentPlanOccurrence.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        ledger: await existing(source.paymentLedger.map(item => item.id), ids => tx.transaction.findMany({ where: { id: { in: ids } }, select: { id: true } })),
      }
      const { backup, remapped } = remapConflicts(source, conflicts)

      for (const item of backup.accounts) await tx.account.create({ data: { id: item.id, userId, name: item.name, type: item.type, balance: item.balance, color: item.color, institution: item.institution, isActive: item.isActive, createdAt: when(item.createdAt) } })
      for (const item of backup.creditCards) await tx.creditCard.create({ data: { id: item.id, userId, name: item.name, bank: item.bank, institution: item.institution, totalLimit: item.totalLimit, usedLimit: item.usedLimit, dueAmount: item.dueAmount, expectedDue: item.expectedDue, billDueDate: when(item.billDueDate) ?? null, minimumDue: item.minimumDue, dueDate: item.dueDate, statementDate: item.statementDate, color: item.color, type: item.type, isActive: item.isActive, reminderDays: item.reminderDays, createdAt: when(item.createdAt) } })
      for (const item of backup.cardBills) await tx.cardBill.create({ data: { id: item.id, creditCardId: item.creditCardId, statementDate: when(item.statementDate) ?? null, dueDate: new Date(item.dueDate), statementAmount: item.statementAmount, minimumDue: item.minimumDue, paidAmount: item.paidAmount, paidAt: when(item.paidAt) ?? null, createdAt: when(item.createdAt) } })
      for (const item of backup.debts) {
        await tx.debt.create({ data: {
          id: item.id, userId, name: item.name, direction: item.direction, type: item.type, amount: item.amount, remaining: item.remaining, interestRate: item.interestRate,
          isRecurring: item.isRecurring, paymentDate: item.paymentDate, paymentAmount: item.paymentAmount, totalInstallments: item.totalInstallments, startDate: when(item.startDate) ?? null,
          totalRepaymentAmount: item.totalRepaymentAmount, totalInterestAmount: item.totalInterestAmount, installmentSchedule: item.installmentSchedule ?? undefined,
          deadline: when(item.deadline) ?? null, priority: item.priority, description: item.description, isActive: item.isActive, createdAt: when(item.createdAt),
          payments: { create: item.payments.map(payment => ({ id: payment.id, amount: payment.amount, principalAmount: payment.principalAmount, interestAmount: payment.interestAmount, installmentNumber: payment.installmentNumber, scheduledDueDate: when(payment.scheduledDueDate) ?? null, transactionId: payment.transactionId, paidDate: new Date(payment.paidDate), accountId: payment.accountId })) },
        } })
      }
      // Test-only: proves a failure part-way through leaves existing data untouched.
      if (process.env.NODE_ENV !== 'production' && process.env.SPENDWISE_TEST_FAIL_RESTORE === 'after-debts') throw new Error('forced restore failure')
      for (const item of backup.incomeSources) {
        await tx.incomeSource.create({ data: {
          id: item.id, userId, accountId: item.accountId, name: item.name, type: item.type, frequency: item.frequency, payday: item.payday, paydayRule: item.paydayRule, grossAmount: item.grossAmount, expectedInHand: item.expectedInHand,
          defaultDeductions: item.defaultDeductions, isActive: item.isActive, createdAt: when(item.createdAt),
          occurrences: { create: item.occurrences.map(row => ({ id: row.id, expectedDate: new Date(row.expectedDate), expectedAmount: row.expectedAmount, actualAmount: row.actualAmount, receivedAt: when(row.receivedAt) ?? null, status: row.status, notes: row.notes, createdAt: when(row.createdAt) })) },
        } })
      }
      for (const item of backup.paymentPlans) {
        await tx.paymentPlan.create({ data: {
          id: item.id, userId, accountId: item.accountId, name: item.name, type: item.type, amount: item.amount, dueDay: item.dueDay, isEssential: item.isEssential, isActive: item.isActive,
          startDate: new Date(item.startDate), endDate: when(item.endDate) ?? null, archivedAt: when(item.archivedAt) ?? null, notes: item.notes, createdAt: when(item.createdAt),
          payments: { create: item.payments.map(row => ({ id: row.id, dueDate: new Date(row.dueDate), amount: row.amount, paidAt: when(row.paidAt) ?? null, accountId: row.accountId, transactionId: row.transactionId, createdAt: when(row.createdAt) })) },
        } })
      }
      for (const item of backup.paymentLedger) await tx.transaction.create({ data: { id: item.id, userId, accountId: item.accountId, toAccountId: item.toAccountId, creditCardId: item.creditCardId, managedPayment: item.managedPayment, type: item.type, amount: item.amount, name: item.name, description: item.description, date: new Date(item.date), createdAt: when(item.createdAt) } })
      for (const item of backup.cardPayments) await tx.cardPayment.create({ data: { id: item.id, creditCardId: item.creditCardId, cardBillId: item.cardBillId, amount: item.amount, paidDate: new Date(item.paidDate), accountId: item.accountId, transactionId: item.transactionId, usedDelta: item.usedDelta, dueDelta: item.dueDelta, minimumDelta: item.minimumDelta, expectedDelta: item.expectedDelta, createdAt: when(item.createdAt) } })
      return { counts: countBackup(backup), remapped }
    }, { timeout: 60000, maxWait: 10000 })

    return NextResponse.json({
      success: true, version: parsed.sourceVersion, restored: result.counts, warnings: parsed.warnings,
      notes: [...parsed.notes, ...(result.remapped ? [`${result.remapped} record id${result.remapped === 1 ? ' was' : 's were'} replaced because the originals are used by another account.`] : [])],
    })
  } catch {
    return NextResponse.json({ error: 'Restore failed. Your existing data was not changed.' }, { status: 500 })
  }
}
