import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  try {
    const backup = await req.json()
    const requiredCollections = ['accounts', 'creditCards', 'debts']
    const paymentLedger = Array.isArray(backup?.paymentLedger) ? backup.paymentLedger : backup?.transactions
    if (!backup || typeof backup !== 'object' || requiredCollections.some(key => !Array.isArray(backup[key])) || !Array.isArray(paymentLedger)) {
      return NextResponse.json({ error: 'Invalid Spendwise backup file' }, { status: 400 })
    }
    const { settings, accounts, creditCards, debts, recurringExpenses, incomeSources, paymentPlans } = backup

    await prisma.$transaction(async (tx) => {
      if (settings) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(typeof settings.currency === 'string' && { currency: settings.currency }),
            ...(typeof settings.cashBuffer === 'number' && { cashBuffer: settings.cashBuffer }),
          },
        })
      }

      // 1. Clean existing records in correct order to avoid reference conflicts
      await tx.paymentPlanOccurrence.deleteMany({ where: { paymentPlan: { userId } } })
      await tx.paymentPlan.deleteMany({ where: { userId } })
      await tx.incomeOccurrence.deleteMany({ where: { incomeSource: { userId } } })
      await tx.incomeSource.deleteMany({ where: { userId } })
      await tx.transaction.deleteMany({ where: { userId } })
      await tx.debt.deleteMany({ where: { userId } })
      await tx.creditCard.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      // 2. Restore accounts
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
              institution: acc.institution || 'OTHER',
              isActive: acc.isActive ?? true,
              createdAt: acc.createdAt ? new Date(acc.createdAt) : undefined,
            },
          })
        }
      }

      // 3. Restore credit cards and pay later accounts
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
              institution: card.institution || 'OTHER',
              type: card.type || 'CARD',
              isActive: card.isActive ?? true,
              reminderDays: card.reminderDays ?? 3,
              createdAt: card.createdAt ? new Date(card.createdAt) : undefined,
            },
          })
        }
      }

      // 4. Restore debts and lending
      if (debts && Array.isArray(debts)) {
        for (const d of debts) {
          await tx.debt.create({
            data: {
              id: d.id,
              userId,
              name: d.name,
              payments: Array.isArray(d.payments) ? { create: d.payments.map((payment: any) => ({
                id: payment.id, amount: payment.amount, paidDate: new Date(payment.paidDate), accountId: payment.accountId || null,
              })) } : undefined,
              direction: d.direction || 'BORROWED',
              type: d.type,
              amount: d.amount,
              remaining: d.remaining,
              interestRate: d.interestRate,
              isRecurring: d.isRecurring ?? false,
              paymentDate: d.paymentDate,
              paymentAmount: d.paymentAmount,
              totalInstallments: d.totalInstallments,
              startDate: d.startDate ? new Date(d.startDate) : null,
              deadline: d.deadline ? new Date(d.deadline) : null,
              priority: d.priority,
              description: d.description,
              isActive: d.isActive ?? true,
              createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
            },
          })
        }
      }

      // 5. Convert recurring records from older backups into their current home.
      if (recurringExpenses && Array.isArray(recurringExpenses)) {
        for (const item of recurringExpenses) {
          if (item.type === 'EMI' || item.type === 'LOAN') {
            const installmentCount = Number(item.totalEMIs || 0)
            const paidCount = Number(item.paidEMIs || 0)
            const originalAmount = Number(item.loanAmount || (Number(item.emiAmount) * Math.max(installmentCount, 1)))
            const remaining = installmentCount > 0
              ? originalAmount * Math.max(installmentCount - paidCount, 0) / installmentCount
              : Math.max(originalAmount - Number(item.emiAmount) * paidCount, 0)
            const recordedPayments = Array.isArray(item.payments) ? item.payments : []
            const payments = recordedPayments.map((payment: any) => ({
              amount: payment.amount,
              paidDate: new Date(payment.paidDate),
              accountId: item.accountId || null,
            }))
            for (let index = recordedPayments.length; index < paidCount; index++) {
              const paidDate = new Date(item.startDate)
              paidDate.setMonth(paidDate.getMonth() + index)
              payments.push({ amount: item.emiAmount, paidDate, accountId: item.accountId || null })
            }
            await tx.debt.create({ data: {
              id: item.id, userId, name: item.name, direction: 'BORROWED', type: 'LOAN',
              amount: originalAmount, remaining, interestRate: item.interestRate || 0,
              isRecurring: true, paymentDate: item.emiDate, paymentAmount: item.emiAmount,
              totalInstallments: item.totalEMIs || null, startDate: new Date(item.startDate),
              priority: 'MEDIUM', description: 'Restored from the former Recurring Payments screen',
              isActive: item.isActive ?? true, createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              payments: payments.length ? { create: payments } : undefined,
            } })
          } else {
            const type = item.type === 'RENT' || item.type === 'UTILITY' || item.type === 'SUBSCRIPTION' ? item.type : 'OTHER'
            const seenDates = new Set<string>()
            const payments = (Array.isArray(item.payments) ? item.payments : []).filter((payment: any) => {
              const key = new Date(payment.paidDate).toISOString()
              if (seenDates.has(key)) return false
              seenDates.add(key)
              return true
            }).map((payment: any) => ({
              dueDate: new Date(payment.paidDate), amount: payment.amount,
              paidAt: new Date(payment.paidDate), accountId: item.accountId || null,
            }))
            await tx.paymentPlan.create({ data: {
              id: item.id, userId, accountId: item.accountId || null, name: item.name, type,
              amount: item.emiAmount, dueDay: item.emiDate, isEssential: true,
              isActive: item.isActive ?? true, startDate: new Date(item.startDate),
              notes: 'Restored from the former Recurring Payments screen',
              payments: payments.length ? { create: payments } : undefined,
            } })
          }
        }
      }
      // Restore income sources and planned bills from the current backup schema.
      if (incomeSources && Array.isArray(incomeSources)) {
        for (const source of incomeSources) {
          await tx.incomeSource.create({ data: {
            id: source.id, userId, accountId: source.accountId || null, name: source.name, type: source.type,
            frequency: source.frequency, payday: source.payday, grossAmount: source.grossAmount,
            expectedInHand: source.expectedInHand, defaultDeductions: source.defaultDeductions || 0, isActive: source.isActive ?? true,
            createdAt: source.createdAt ? new Date(source.createdAt) : undefined,
            occurrences: Array.isArray(source.occurrences) ? { create: source.occurrences.map((item: any) => ({ id: item.id, expectedDate: new Date(item.expectedDate), expectedAmount: item.expectedAmount, actualAmount: item.actualAmount, receivedAt: item.receivedAt ? new Date(item.receivedAt) : null, status: item.status, notes: item.notes, createdAt: item.createdAt ? new Date(item.createdAt) : undefined })) } : undefined,
          } })
        }
      }
      if (paymentPlans && Array.isArray(paymentPlans)) {
        for (const plan of paymentPlans) {
          await tx.paymentPlan.create({ data: {
            id: plan.id, userId, accountId: plan.accountId || null, name: plan.name, type: plan.type,
            amount: plan.amount, dueDay: plan.dueDay, isEssential: plan.isEssential ?? true, isActive: plan.isActive ?? true,
            startDate: new Date(plan.startDate), notes: plan.notes, createdAt: plan.createdAt ? new Date(plan.createdAt) : undefined,
            payments: Array.isArray(plan.payments) ? { create: plan.payments.map((item: any) => ({ id: item.id, dueDate: new Date(item.dueDate), amount: item.amount, paidAt: item.paidAt ? new Date(item.paidAt) : null, accountId: item.accountId || null, createdAt: item.createdAt ? new Date(item.createdAt) : undefined })) } : undefined,
          } })
        }
      }

      // 6. Restore the internal balance and payment ledger.
      if (paymentLedger.length) {
        for (const t of paymentLedger) {
          await tx.transaction.create({
            data: {
              id: t.id,
              userId,
              accountId: t.accountId,
              toAccountId: t.toAccountId,
              creditCardId: t.creditCardId,
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
    return NextResponse.json({ error: e.message || 'Restore failed' }, { status: 500 })
  }
}
