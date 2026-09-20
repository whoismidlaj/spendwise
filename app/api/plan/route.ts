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
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const end = new Date(start)
  end.setDate(end.getDate() + Math.min(180, Math.max(30, Number(new URL(req.url).searchParams.get('days') || 90))))
  const months = monthsInRange(start, end)
  const [user, accounts, incomeSources, plans, recurring, cards, debts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { cashBuffer: true } }),
    prisma.account.findMany({ where: { userId: session.user.id, isActive: true }, select: { id: true, name: true, balance: true } }),
    prisma.incomeSource.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, occurrences: true } }),
    prisma.paymentPlan.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, payments: true } }),
    prisma.recurringExpense.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { name: true } }, payments: true } }),
    prisma.creditCard.findMany({ where: { userId: session.user.id, isActive: true } }),
    prisma.debt.findMany({ where: { userId: session.user.id, isActive: true, direction: 'BORROWED' }, include: { payments: true } }),
  ])
  const items: FlowItem[] = []
  for (const income of incomeSources) {
    if (income.frequency !== 'MONTHLY' || !income.payday) continue
    for (const { year, month } of months) {
      const date = monthDate(year, month, income.payday)
      if (date < start || date > end) continue
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
      if (date < start || date > end || date < plan.startDate) continue
      if (plan.payments.some(payment => dateKey(new Date(payment.dueDate)) === dateKey(date) && payment.paidAt)) continue
      items.push({ id: `plan-${plan.id}-${dateKey(date)}`, date, name: plan.name, kind: 'PAYMENT', source: plan.type, amount: Number(plan.amount), reservedAmount: plan.isEssential ? Number(plan.amount) : 0, isEssential: plan.isEssential, status: date < now ? 'OVERDUE' : 'EXPECTED', accountName: plan.account?.name })
    }
  }
  for (const item of recurring) {
    for (const { year, month } of months) {
      const date = monthDate(year, month, item.emiDate)
      if (date < start || date > end || date < item.startDate || (item.totalEMIs && item.paidEMIs >= item.totalEMIs)) continue
      if (item.payments.some(payment => new Date(payment.paidDate).getFullYear() === year && new Date(payment.paidDate).getMonth() === month)) continue
      items.push({ id: `recurring-${item.id}-${dateKey(date)}`, date, name: item.name, kind: 'PAYMENT', source: item.type, amount: Number(item.emiAmount), reservedAmount: Number(item.emiAmount), isEssential: true, status: date < now ? 'OVERDUE' : 'EXPECTED', accountName: item.account?.name })
    }
  }
  for (const debt of debts) {
    if (!debt.isRecurring || !debt.paymentDate || !debt.paymentAmount) {
      if (debt.deadline && debt.deadline >= start && debt.deadline <= end && Number(debt.remaining) > 0) {
        const amount = Number(debt.remaining)
        items.push({ id: `debt-deadline-${debt.id}`, date: debt.deadline, name: debt.name, kind: 'PAYMENT', source: 'DEBT', amount, reservedAmount: amount, isEssential: true, status: debt.deadline < now ? 'OVERDUE' : 'EXPECTED' })
      }
      continue
    }
    for (const { year, month } of months) {
      const date = monthDate(year, month, debt.paymentDate)
      if (date < start || date > end || debt.payments.some(payment => new Date(payment.paidDate).getFullYear() === year && new Date(payment.paidDate).getMonth() === month)) continue
      const amount = Math.min(Number(debt.paymentAmount), Number(debt.remaining))
      items.push({ id: `debt-${debt.id}-${dateKey(date)}`, date, name: debt.name, kind: 'PAYMENT', source: 'DEBT', amount, reservedAmount: amount, isEssential: true, status: date < now ? 'OVERDUE' : 'EXPECTED' })
    }
  }
  for (const card of cards) {
    if (Number(card.dueAmount) <= 0) continue
    const date = card.billDueDate ?? monthDate(now.getFullYear(), now.getMonth(), card.dueDate)
    if (date >= start && date <= end) items.push({ id: `card-${card.id}`, date, name: `${card.bank} ${card.name}`, kind: 'PAYMENT', source: card.type === 'PAYLATER' ? 'PAY_LATER' : 'CARD', amount: Number(card.dueAmount), reservedAmount: Number(card.minimumDue) || Number(card.dueAmount), isEssential: true, status: date < now ? 'OVERDUE' : 'EXPECTED' })
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === 'PAYMENT' ? -1 : 1))
  const bankBalance = accounts.reduce((total, account) => total + Number(account.balance), 0)
  const expectedIncome = items.filter(item => item.kind === 'INCOME' && item.status === 'EXPECTED').reduce((total, item) => total + item.amount, 0)
  // Income received before today still belongs in this month's in-hand total,
  // even though the forward-looking timeline starts today.
  const receivedIncome = incomeSources.flatMap(source => source.occurrences)
    .filter(item => item.status === 'RECEIVED' && item.receivedAt && item.receivedAt >= monthStart && item.receivedAt < nextMonthStart)
    .reduce((total, item) => total + Number(item.actualAmount || 0), 0)
  const requiredPayments = items.filter(item => item.kind === 'PAYMENT' && item.isEssential).reduce((total, item) => total + item.reservedAmount, 0)
  const optionalPayments = items.filter(item => item.kind === 'PAYMENT' && !item.isEssential).reduce((total, item) => total + item.amount, 0)
  const cashBuffer = Number(user.cashBuffer)
  let running = bankBalance
  let lowest = running
  const timeline = items.map(item => {
    running += item.kind === 'INCOME' ? item.amount : -item.reservedAmount
    lowest = Math.min(lowest, running)
    return { ...item, projectedBalance: running }
  })
  return NextResponse.json(toJson({
    accounts, items: timeline, summary: { bankBalance, expectedIncome, receivedIncome, requiredPayments, optionalPayments, cashBuffer, safeToSpend: bankBalance + expectedIncome - requiredPayments - cashBuffer, lowestProjectedBalance: lowest, shortfall: Math.max(0, cashBuffer - lowest) },
  }))
}
