import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  try {
    const { accounts, creditCards, categories, debts, transactions } = await req.json()

    await prisma.$transaction(async (tx) => {
      // 1. Clean existing records in correct order to avoid reference conflicts
      await tx.budget.deleteMany({ where: { userId } })
      await tx.transaction.deleteMany({ where: { userId } })
      await tx.recurringExpense.deleteMany({ where: { userId } })
      await tx.debt.deleteMany({ where: { userId } })
      await tx.creditCard.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.category.deleteMany({ where: { userId } })

      // 2. Import Custom Categories
      if (categories && Array.isArray(categories)) {
        for (const cat of categories) {
          await tx.category.create({
            data: {
              id: cat.id,
              userId,
              name: cat.name,
              icon: cat.icon,
              color: cat.color,
              type: cat.type,
              isSystem: cat.isSystem ?? false,
            },
          })
        }
      }

      // 3. Import Accounts
      if (accounts && Array.isArray(accounts)) {
        for (const acc of accounts) {
          await tx.account.create({
            data: {
              id: acc.id,
              userId,
              name: acc.name,
              type: acc.type,
              balance: acc.balance,
              color: acc.color,
              isActive: acc.isActive ?? true,
              createdAt: acc.createdAt ? new Date(acc.createdAt) : undefined,
            },
          })
        }
      }

      // 4. Import Credit Cards / Pay Laters
      if (creditCards && Array.isArray(creditCards)) {
        for (const card of creditCards) {
          await tx.creditCard.create({
            data: {
              id: card.id,
              userId,
              name: card.name,
              bank: card.bank,
              totalLimit: card.totalLimit,
              usedLimit: card.usedLimit,
              dueAmount: card.dueAmount,
              minimumDue: card.minimumDue || 0,
              dueDate: card.dueDate,
              statementDate: card.statementDate,
              color: card.color,
              type: card.type || 'CARD',
              isActive: card.isActive ?? true,
              createdAt: card.createdAt ? new Date(card.createdAt) : undefined,
            },
          })
        }
      }

      // 5. Import Debts
      if (debts && Array.isArray(debts)) {
        for (const d of debts) {
          await tx.debt.create({
            data: {
              id: d.id,
              userId,
              name: d.name,
              type: d.type,
              amount: d.amount,
              remaining: d.remaining,
              interestRate: d.interestRate,
              isRecurring: d.isRecurring ?? false,
              paymentDate: d.paymentDate,
              paymentAmount: d.paymentAmount,
              deadline: d.deadline ? new Date(d.deadline) : null,
              priority: d.priority,
              description: d.description,
              isActive: d.isActive ?? true,
              createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
            },
          })
        }
      }

      // 6. Import Transactions
      if (transactions && Array.isArray(transactions)) {
        for (const t of transactions) {
          await tx.transaction.create({
            data: {
              id: t.id,
              userId,
              accountId: t.accountId,
              toAccountId: t.toAccountId,
              creditCardId: t.creditCardId,
              categoryId: t.categoryId,
              type: t.type,
              amount: t.amount,
              name: t.name,
              description: t.description,
              date: new Date(t.date),
              createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Import failed' }, { status: 500 })
  }
}
