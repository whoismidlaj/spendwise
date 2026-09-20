import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const [settings, accounts, creditCards, debts, transactions, incomeSources, paymentPlans] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { currency: true, cashBuffer: true } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId }, include: { payments: true } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId }, include: { occurrences: true } }),
    prisma.paymentPlan.findMany({ where: { userId }, include: { payments: true } }),
  ])

  const backup = {
    format: 'spendwise-backup',
    version: '3.0',
    schema: 'monthly-planning',
    createdAt: new Date().toISOString(),
    settings,
    accounts,
    creditCards,
    debts,
    incomeSources,
    paymentPlans,
    paymentLedger: transactions,
  }

  return new NextResponse(JSON.stringify(toJson(backup), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="spendwise-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
