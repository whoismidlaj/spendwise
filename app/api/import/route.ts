import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  try {
    const { accounts, creditCards, categories, debts, transactions, recurringExpenses, budgets, incomeSources, paymentPlans } = await req.json()

    await prisma.$transaction(async (tx) => {
      // 1. Clean existing records in correct order to avoid reference conflicts
      await tx.budget.deleteMany({ where: { userId } })
      await tx.paymentPlanOccurrence.deleteMany({ where: { paymentPlan: { userId } } })
      await tx.paymentPlan.deleteMany({ where: { userId } })
      await tx.incomeOccurrence.deleteMany({ where: { incomeSource: { userId } } })
      await tx.incomeSource.deleteMany({ where: { userId } })
      await tx.eMIPayment.deleteMany({ where: { recurringExpense: { userId } } })
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
              expectedDue: card.expectedDue ?? null,
              billDueDate: card.billDueDate ? new Date(card.billDueDate) : null,
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
              payments: Array.isArray(d.payments) ? { create: d.payments.map((payment: any) => ({
                amount: payment.amount, paidDate: new Date(payment.paidDate), accountId: payment.accountId || null,
              })) } : undefined,
              direction: d.direction || 'BORROWED',
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

      // 6. Import recurring schedules, income sources and planned bills.
      if (recurringExpenses && Array.isArray(recurringExpenses)) {
        for (const item of recurringExpenses) {
          await tx.recurringExpense.create({ data: {
            id: item.id, userId, accountId: item.accountId || null, name: item.name, type: item.type,
            loanAmount: item.loanAmount, interestRate: item.interestRate, additionalFees: item.additionalFees,
            emiAmount: item.emiAmount, emiDate: item.emiDate, totalEMIs: item.totalEMIs,
            paidEMIs: item.paidEMIs || 0, startDate: new Date(item.startDate), isActive: item.isActive ?? true,
            payments: Array.isArray(item.payments) ? { create: item.payments.map((payment: any) => ({ amount: payment.amount, paidDate: new Date(payment.paidDate), emiNumber: payment.emiNumber })) } : undefined,
          } })
        }
      }
      if (incomeSources && Array.isArray(incomeSources)) {
        for (const source of incomeSources) {
          await tx.incomeSource.create({ data: {
            id: source.id, userId, accountId: source.accountId || null, name: source.name, type: source.type,
            frequency: source.frequency, payday: source.payday, grossAmount: source.grossAmount,
            expectedInHand: source.expectedInHand, defaultDeductions: source.defaultDeductions || 0, isActive: source.isActive ?? true,
            occurrences: Array.isArray(source.occurrences) ? { create: source.occurrences.map((item: any) => ({ expectedDate: new Date(item.expectedDate), expectedAmount: item.expectedAmount, actualAmount: item.actualAmount, receivedAt: item.receivedAt ? new Date(item.receivedAt) : null, status: item.status, notes: item.notes })) } : undefined,
          } })
        }
      }
      if (paymentPlans && Array.isArray(paymentPlans)) {
        for (const plan of paymentPlans) {
          await tx.paymentPlan.create({ data: {
            id: plan.id, userId, accountId: plan.accountId || null, name: plan.name, type: plan.type,
            amount: plan.amount, dueDay: plan.dueDay, isEssential: plan.isEssential ?? true, isActive: plan.isActive ?? true,
            startDate: new Date(plan.startDate), notes: plan.notes,
            payments: Array.isArray(plan.payments) ? { create: plan.payments.map((item: any) => ({ dueDate: new Date(item.dueDate), amount: item.amount, paidAt: item.paidAt ? new Date(item.paidAt) : null, accountId: item.accountId || null })) } : undefined,
          } })
        }
      }

      if (budgets && Array.isArray(budgets)) {
        for (const budget of budgets) {
          await tx.budget.create({ data: { id: budget.id, userId, categoryId: budget.categoryId, amount: budget.amount, month: budget.month, year: budget.year } })
        }
      }

      // 7. Import Transactions
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
              managedPayment: t.managedPayment ?? false,
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
