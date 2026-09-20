import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { dateKey, monthDate, monthsInRange } from '@/lib/planning'

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
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const period = new URL(req.url).searchParams.get('period') === 'next' ? 'next' : 'month'
  const start = period === 'next' ? nextMonthStart : monthStart
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
  const endExclusive = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const generationStart = monthStart
  const months = monthsInRange(generationStart, end)
  const [user, accounts, incomeSources, plans, cards, debts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { cashBuffer: true } }),
    prisma.account.findMany({ where: { userId: session.user.id, isActive: true }, select: { id: true, name: true, balance: true } }),
    prisma.incomeSource.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, occurrences: true } }),
    prisma.paymentPlan.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, payments: true } }),
    prisma.creditCard.findMany({ where: { userId: session.user.id, isActive: true } }),
    prisma.debt.findMany({ where: { userId: session.user.id, isActive: true, direction: 'BORROWED' }, include: { payments: true } }),
  ])
  const items: FlowItem[] = []
  for (const income of incomeSources) {
    if (income.frequency !== 'MONTHLY' || !income.payday) continue
    for (const { year, month } of months) {
      const date = monthDate(year, month, income.payday)
      if (date < generationStart || date > end) continue
      const occurrence = income.occurrences.find(item => dateKey(new Date(item.expectedDate)) === dateKey(date))
      if (occurrence?.status === 'SKIPPED') continue
      // The actual receipt is already in the live account balance. Only an
      // unpaid expected income belongs in the forward cash-flow projection.
      if (occurrence?.status === 'RECEIVED') continue
      items.push({ id: `income-${income.id}-${dateKey(date)}`, date, name: income.name, kind: 'INCOME', source: income.type, amount: Number(occurrence?.expectedAmount ?? income.expectedInHand), reservedAmount: 0, isEssential: true, status: 'EXPECTED', accountName: income.account?.name })
    }
  }
  for (const plan of plans) {
    for (const { year, month } of months) {
      const date = monthDate(year, month, plan.dueDay)
      if (date < generationStart || date > end || date < plan.startDate) continue
      if (plan.payments.some(payment => dateKey(new Date(payment.dueDate)) === dateKey(date) && payment.paidAt)) continue
      items.push({ id: `plan-${plan.id}-${dateKey(date)}`, date, name: plan.name, kind: 'PAYMENT', source: plan.type, amount: Number(plan.amount), reservedAmount: plan.isEssential ? Number(plan.amount) : 0, isEssential: plan.isEssential, status: date < now ? 'OVERDUE' : 'EXPECTED', accountName: plan.account?.name })
    }
  }
  for (const debt of debts) {
    if (!debt.isRecurring || !debt.paymentDate || !debt.paymentAmount) {
      if (debt.deadline && debt.deadline <= end && Number(debt.remaining) > 0) {
        const amount = Number(debt.remaining)
        items.push({ id: `debt-deadline-${debt.id}`, date: debt.deadline, name: debt.name, kind: 'PAYMENT', source: 'DEBT', amount, reservedAmount: amount, isEssential: true, status: debt.deadline < now ? 'OVERDUE' : 'EXPECTED' })
      }
      continue
    }
    for (const { year, month } of months) {
      const date = monthDate(year, month, debt.paymentDate)
      if (date < generationStart || date > end || debt.payments.some(payment => new Date(payment.paidDate).getFullYear() === year && new Date(payment.paidDate).getMonth() === month)) continue
      const amount = Math.min(Number(debt.paymentAmount), Number(debt.remaining))
      items.push({ id: `debt-${debt.id}-${dateKey(date)}`, date, name: debt.name, kind: 'PAYMENT', source: 'DEBT', amount, reservedAmount: amount, isEssential: true, status: date < now ? 'OVERDUE' : 'EXPECTED' })
    }
  }
  for (const card of cards) {
    if (Number(card.dueAmount) <= 0) continue
    const date = card.billDueDate ?? monthDate(now.getFullYear(), now.getMonth(), card.dueDate)
    if (date <= end) items.push({ id: `card-${card.id}`, date, name: `${card.bank} ${card.name}`, kind: 'PAYMENT', source: card.type === 'PAYLATER' ? 'PAY_LATER' : 'CARD', amount: Number(card.dueAmount), reservedAmount: Number(card.minimumDue) || Number(card.dueAmount), isEssential: true, status: date < now ? 'OVERDUE' : 'EXPECTED' })
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
    accounts, items: timeline, summary: { bankBalance, openingBalance, expectedIncome, receivedIncome, requiredPayments, optionalPayments, cashBuffer, safeToSpend: openingBalance + expectedIncome - requiredPayments - cashBuffer, lowestProjectedBalance: lowest, shortfall: Math.max(0, cashBuffer - lowest) },
  }))
}
