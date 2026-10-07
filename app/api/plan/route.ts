import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { now as currentTime } from '@/lib/clock'
import { dateKey, monthDate, monthsInRange } from '@/lib/planning'
import { incomeDate } from '@/lib/income'
import { loadObligations, OVERDUE_LOOKBACK_MONTHS } from '@/lib/obligations'

type FlowItem = {
  id: string
  date: Date
  name: string
  kind: 'INCOME' | 'PAYMENT'
  source: string
  amount: number
  reservedAmount: number
  isEssential: boolean
  status: 'EXPECTED' | 'RECEIVED' | 'PAID' | 'OVERDUE'
  accountName?: string
  reserves?: 'FULL' | 'MINIMUM' | 'NONE'
  sourceType?: string
  sourceId?: string
  occurrenceId?: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = currentTime()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const period = new URL(req.url).searchParams.get('period') === 'next' ? 'next' : 'month'
  const start = period === 'next' ? nextMonthStart : monthStart
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
  const endExclusive = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const generationStart = monthStart
  const lookbackStart = new Date(now.getFullYear(), now.getMonth() - OVERDUE_LOOKBACK_MONTHS, 1)
  const months = monthsInRange(generationStart, end)
  const [user, accounts, incomeSources] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { cashBuffer: true } }),
    prisma.account.findMany({ where: { userId: session.user.id, isActive: true }, select: { id: true, name: true, balance: true } }),
    prisma.incomeSource.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, occurrences: true } }),
  ])
  const items: FlowItem[] = []
  const unconfirmedIncome: { sourceId: string; name: string; date: Date; amount: number }[] = []
  for (const income of incomeSources) {
    if (income.frequency !== 'MONTHLY' || (!income.payday && income.paydayRule !== 'LAST_WORKING_DAY')) continue
    for (const { year, month } of months) {
      const date = incomeDate(year, month, income)!
      if (date < generationStart || date > end) continue
      const occurrence = income.occurrences.find(item => dateKey(new Date(item.expectedDate)) === dateKey(date))
      if (occurrence?.status === 'SKIPPED') continue
      // The actual receipt is already in the live account balance. Only an
      // unpaid expected income belongs in the forward cash-flow projection.
      if (occurrence?.status === 'RECEIVED') continue
      // A passed payday that nobody confirmed may already be in the bank balance, so it is not forecast.
      if ((!occurrence || occurrence.status === 'EXPECTED') && date < todayStart) { unconfirmedIncome.push({ sourceId: income.id, name: income.name, date, amount: Number(income.expectedInHand) }); continue }
      items.push({ id: `income-${income.id}-${dateKey(date)}`, date, name: income.name, kind: 'INCOME', source: income.type, amount: Number(occurrence?.expectedAmount ?? income.expectedInHand), reservedAmount: 0, isEssential: true, status: 'EXPECTED', accountName: income.account?.name })
    }
  }
  // Payments come from the shared obligation service; paid ones are already in bank balances.
  const obligations = await loadObligations(prisma, session.user.id, { from: lookbackStart, to: end, now })
  for (const obligation of obligations) {
    if (obligation.status === 'PAID') continue
    items.push({
      id: obligation.key, date: obligation.dueDate, name: obligation.name, kind: 'PAYMENT',
      source: obligation.sourceType === 'RECURRING' ? obligation.category : obligation.sourceType === 'CARD' ? obligation.category : 'DEBT',
      amount: obligation.amount, reservedAmount: obligation.reservedAmount, reserves: obligation.reserves, isEssential: obligation.isRequired,
      status: obligation.status === 'OVERDUE' ? 'OVERDUE' : 'EXPECTED', accountName: obligation.accountName,
      sourceType: obligation.sourceType, sourceId: obligation.sourceId, occurrenceId: obligation.occurrenceId,
    })
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === 'PAYMENT' ? -1 : 1))
  const selectedItems = period === 'next' ? items.filter(item => item.date >= start) : items
  const carryItems = period === 'next' ? items.filter(item => item.date < start) : []
  const bankBalance = accounts.reduce((total, account) => total + Number(account.balance), 0)
  const openingBalance = bankBalance
    + carryItems.filter(item => item.kind === 'INCOME').reduce((total, item) => total + item.amount, 0)
    - carryItems.filter(item => item.kind === 'PAYMENT' && item.isEssential).reduce((total, item) => total + item.reservedAmount, 0)
  const expectedIncome = selectedItems.filter(item => item.kind === 'INCOME' && item.status === 'EXPECTED').reduce((total, item) => total + item.amount, 0)
  const receivedIncome = incomeSources.flatMap(source => source.occurrences)
    .filter(item => item.status === 'RECEIVED' && item.receivedAt && item.receivedAt >= start && item.receivedAt < endExclusive)
    .reduce((total, item) => total + Number(item.actualAmount || 0), 0)
  const requiredPayments = selectedItems.filter(item => item.kind === 'PAYMENT' && item.isEssential).reduce((total, item) => total + item.reservedAmount, 0)
  const optionalPayments = selectedItems.filter(item => item.kind === 'PAYMENT' && !item.isEssential).reduce((total, item) => total + item.amount, 0)
  const cashBuffer = Number(user.cashBuffer)
  let running = openingBalance
  let lowest = running
  const timeline = selectedItems.map(item => {
    running += item.kind === 'INCOME' ? item.amount : -item.reservedAmount
    lowest = Math.min(lowest, running)
    return { ...item, projectedBalance: running }
  })
  return NextResponse.json(toJson({
    accounts, unconfirmedIncome, items: timeline, summary: { bankBalance, openingBalance, expectedIncome, receivedIncome, requiredPayments, optionalPayments, cashBuffer, safeToSpend: openingBalance + expectedIncome - requiredPayments - cashBuffer, lowestProjectedBalance: lowest, shortfall: Math.max(0, cashBuffer - lowest) },
  }))
}
