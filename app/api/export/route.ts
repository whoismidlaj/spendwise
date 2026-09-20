import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const [accounts, creditCards, categories, debts, transactions, recurringExpenses, budgets, incomeSources, paymentPlans] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId }, include: { payments: true } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.recurringExpense.findMany({ where: { userId }, include: { payments: true } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId }, include: { occurrences: true } }),
    prisma.paymentPlan.findMany({ where: { userId }, include: { payments: true } }),
  ])

  const backupData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    accounts,
    creditCards,
    categories,
    debts,
    recurringExpenses,
    budgets,
    incomeSources,
    paymentPlans,
    transactions,
  }

  return new NextResponse(JSON.stringify(toJson(backupData), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="spendwise-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
