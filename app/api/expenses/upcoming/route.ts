import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export interface UpcomingItem {
  id: string
  sourceId: string
  name: string
  source: 'CREDIT_CARD' | 'RECURRING' | 'DEBT'
  typeLabel: string
  amount: number
  dueDate: string // ISO string
  dueDay: number
  daysLeft: number
  isOverdue: boolean
  color?: string
  bank?: string
  accountName?: string
  accountId?: string
  minimumAmount?: number
  remainingTotal?: number
  paidCount?: number
  totalCount?: number
}

// Helper to iterate months between two dates (inclusive)
function getMonthsInRange(startDate: Date, endDate: Date) {
  const months: Array<{ year: number; month: number }> = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

  while (current <= end) {
    months.push({ year: current.getFullYear(), month: current.getMonth() })
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

function getValidDay(year: number, month: number, targetDay: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Math.min(targetDay, daysInMonth)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const startParam = searchParams.get('startDate')
  const endParam = searchParams.get('endDate')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  // Default to current month if not provided
  const rangeStart = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const rangeEnd = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [creditCards, recurringExpenses, debts] = await Promise.all([
    prisma.creditCard.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.recurringExpense.findMany({
      where: { userId: session.user.id, isActive: true },
      include: {
        account: { select: { id: true, name: true } },
        payments: {
          orderBy: { paidDate: 'desc' },
        },
      },
      orderBy: { emiDate: 'asc' },
    }),
    prisma.debt.findMany({
      where: { userId: session.user.id, isActive: true },
      include: {
        payments: {
          orderBy: { paidDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const upcomingItems: UpcomingItem[] = []
  const months = getMonthsInRange(rangeStart, rangeEnd)

  // 1. Process Credit Cards
  for (const card of creditCards) {
    const dueAmount = Number(card.dueAmount)
    const minimumDue = Number(card.minimumDue)
    if (dueAmount > 0 || minimumDue > 0) {
      // If minimumDue > 0, use minimumDue as the primary bill amount, otherwise full dueAmount
      const primaryAmount = minimumDue > 0 ? minimumDue : dueAmount

      for (const { year, month } of months) {
        const day = getValidDay(year, month, card.dueDate)
        const dueDate = new Date(year, month, day, 23, 59, 59, 999)

        if (dueDate >= rangeStart && dueDate <= rangeEnd) {
          const diffTime = dueDate.getTime() - todayStart.getTime()
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          upcomingItems.push({
            id: `cc-${card.id}-${year}-${month}`,
            sourceId: card.id,
            name: `${card.bank} ${card.name}`,
            source: 'CREDIT_CARD',
            typeLabel: card.type === 'PAYLATER' ? 'Pay Later' : (minimumDue > 0 ? 'Card Min Due' : 'Credit Card Bill'),
            amount: primaryAmount,
            minimumAmount: minimumDue > 0 ? minimumDue : undefined,
            remainingTotal: dueAmount,
            dueDate: dueDate.toISOString(),
            dueDay: card.dueDate,
            daysLeft,
            isOverdue: daysLeft < 0,
            color: card.color,
            bank: card.bank,
          })
        }
      }
    }
  }


  // 2. Process Recurring Expenses (EMIs, Subscriptions, Rent, Utilities, etc.)
  for (const item of recurringExpenses) {
    const emiAmount = Number(item.emiAmount)
    const startDate = new Date(item.startDate)

    for (const { year, month } of months) {
      const day = getValidDay(year, month, item.emiDate)
      const dueDate = new Date(year, month, day, 23, 59, 59, 999)

      // Only if within range and after or equal to the start date month
      if (dueDate >= rangeStart && dueDate <= rangeEnd && dueDate >= startDate) {
        // Check if finished (if totalEMIs is defined)
        if (item.totalEMIs && item.paidEMIs >= item.totalEMIs) {
          continue
        }

        // Check if already paid in this specific year/month
        const alreadyPaidThisMonth = item.payments.some((p) => {
          const pDate = new Date(p.paidDate)
          return pDate.getFullYear() === year && pDate.getMonth() === month
        })

        if (!alreadyPaidThisMonth) {
          const diffTime = dueDate.getTime() - todayStart.getTime()
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          const typeLabels: Record<string, string> = {
            EMI: 'Loan EMI',
            LOAN: 'Loan',
            SUBSCRIPTION: 'Subscription',
            UTILITY: 'Utility Bill',
            RENT: 'Rent',
            OTHER: 'Recurring Expense',
          }

          upcomingItems.push({
            id: `rec-${item.id}-${year}-${month}`,
            sourceId: item.id,
            name: item.name,
            source: 'RECURRING',
            typeLabel: typeLabels[item.type] || 'Recurring',
            amount: emiAmount,
            dueDate: dueDate.toISOString(),
            dueDay: item.emiDate,
            daysLeft,
            isOverdue: daysLeft < 0,
            accountName: item.account?.name,
            accountId: item.accountId || undefined,
            paidCount: item.paidEMIs,
            totalCount: item.totalEMIs || undefined,
            remainingTotal: item.loanAmount ? Number(item.loanAmount) : undefined,
          })
        }
      }
    }
  }

  // 3. Process Debts
  for (const debt of debts) {
    const remaining = Number(debt.remaining)
    if (remaining <= 0) continue

    if (debt.isRecurring && debt.paymentDate && debt.paymentAmount) {
      const pAmount = Number(debt.paymentAmount)

      for (const { year, month } of months) {
        const day = getValidDay(year, month, debt.paymentDate)
        const dueDate = new Date(year, month, day, 23, 59, 59, 999)

        if (dueDate >= rangeStart && dueDate <= rangeEnd) {
          // Check if payment was made in this month
          const alreadyPaidThisMonth = debt.payments.some((p) => {
            const pDate = new Date(p.paidDate)
            return pDate.getFullYear() === year && pDate.getMonth() === month
          })

          if (!alreadyPaidThisMonth) {
            const diffTime = dueDate.getTime() - todayStart.getTime()
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            const debtTypeLabels: Record<string, string> = {
              PERSONAL: 'Personal Debt EMI',
              LOAN: 'Debt Loan EMI',
              CREDIT_LINE: 'Credit Line Payment',
              PAY_LATER: 'Pay Later EMI',
            }

            upcomingItems.push({
              id: `debt-${debt.id}-${year}-${month}`,
              sourceId: debt.id,
              name: debt.name,
              source: 'DEBT',
              typeLabel: debtTypeLabels[debt.type] || 'Debt EMI',
              amount: Math.min(pAmount, remaining),
              dueDate: dueDate.toISOString(),
              dueDay: debt.paymentDate,
              daysLeft,
              isOverdue: daysLeft < 0,
              remainingTotal: remaining,
            })
          }
        }
      }
    } else if (debt.deadline) {
      const deadlineDate = new Date(debt.deadline)
      if (deadlineDate >= rangeStart && deadlineDate <= rangeEnd) {
        const diffTime = deadlineDate.getTime() - todayStart.getTime()
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        upcomingItems.push({
          id: `debt-deadline-${debt.id}`,
          sourceId: debt.id,
          name: debt.name,
          source: 'DEBT',
          typeLabel: 'Debt Payoff Deadline',
          amount: remaining,
          dueDate: deadlineDate.toISOString(),
          dueDay: deadlineDate.getDate(),
          daysLeft,
          isOverdue: daysLeft < 0,
          remainingTotal: remaining,
        })
      }
    }
  }

  // Sort upcoming items chronologically by due date
  upcomingItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  // Calculate breakdown summary
  const summary = {
    total: upcomingItems.reduce((acc, i) => acc + i.amount, 0),
    creditCards: upcomingItems
      .filter((i) => i.source === 'CREDIT_CARD')
      .reduce((acc, i) => acc + i.amount, 0),
    recurring: upcomingItems
      .filter((i) => i.source === 'RECURRING')
      .reduce((acc, i) => acc + i.amount, 0),
    debts: upcomingItems
      .filter((i) => i.source === 'DEBT')
      .reduce((acc, i) => acc + i.amount, 0),
    totalCount: upcomingItems.length,
    overdueCount: upcomingItems.filter((i) => i.isOverdue).length,
  }

  return NextResponse.json({
    items: toJson(upcomingItems),
    summary: toJson(summary),
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  })
}
