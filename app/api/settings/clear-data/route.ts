import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#ef4444' },
  { name: 'Groceries', icon: '🛒', color: '#f97316' },
  { name: 'Transport', icon: '🚌', color: '#eab308' },
  { name: 'Shopping', icon: '🛍', color: '#a855f7' },
  { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { name: 'Utilities', icon: '⚡', color: '#06b6d4' },
  { name: 'Health', icon: '💊', color: '#10b981' },
  { name: 'Education', icon: '📚', color: '#3b82f6' },
  { name: 'Travel', icon: '✈️', color: '#8b5cf6' },
  { name: 'Other', icon: '📌', color: '#6b7280' },
]

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#22c55e' },
  { name: 'Freelance', icon: '💻', color: '#14b8a6' },
  { name: 'Investment', icon: '📈', color: '#6366f1' },
  { name: 'Gift', icon: '🎁', color: '#f43f5e' },
  { name: 'Other Income', icon: '💰', color: '#84cc16' },
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete dependent payment and planning records before their accounts.
      await tx.paymentPlanOccurrence.deleteMany({ where: { paymentPlan: { userId } } })
      await tx.paymentPlan.deleteMany({ where: { userId } })
      await tx.incomeOccurrence.deleteMany({ where: { incomeSource: { userId } } })
      await tx.incomeSource.deleteMany({ where: { userId } })
      await tx.eMIPayment.deleteMany({ where: { recurringExpense: { userId } } })
      await tx.recurringExpense.deleteMany({ where: { userId } })
      await tx.debtPayment.deleteMany({ where: { debt: { userId } } })
      await tx.debt.deleteMany({ where: { userId } })
      await tx.budget.deleteMany({ where: { userId } })
      await tx.transaction.deleteMany({ where: { userId } })

      // 2. Delete accounts and cards
      await tx.creditCard.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })

      // 3. Reset categories
      await tx.category.deleteMany({ where: { userId } })

      // 4. Seed default categories back
      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        await tx.category.create({
          data: { ...cat, userId, type: 'EXPENSE', isSystem: true },
        })
      }
      for (const cat of DEFAULT_INCOME_CATEGORIES) {
        await tx.category.create({
          data: { ...cat, userId, type: 'INCOME', isSystem: true },
        })
      }
    })

    return NextResponse.json({ success: true, message: 'All user data has been cleared.' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to clear data' }, { status: 500 })
  }
}
