import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/request-auth'
import { prisma, toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { formatCurrency } from '@/lib/currency'
import { z } from 'zod'

const reconcileSchema = z.object({
  actualBalance: z.number().finite(),
  note: z.string().trim().max(100).optional(),
  date: z.string().date().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = reconcileSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { actualBalance, note, date: dateStr } = parsed.data
  const date = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date()

  try {
    const result = await atomic(async tx => {
      const account = await tx.account.findFirst({
        where: { id, userId, isActive: true },
      })
      if (!account) throw new PaymentError('Account not found', 404)

      const currentBalance = Number(account.balance)
      const diff = Math.round((actualBalance - currentBalance) * 100) / 100

      if (diff === 0) {
        return { account, transaction: null, message: 'Balance is already up to date' }
      }

      const isExpense = diff < 0
      const amount = Math.abs(diff)
      const defaultName = isExpense ? 'Balance Adjustment (Expense)' : 'Balance Adjustment (Income)'
      const transactionName = note || defaultName
      const description = `Reconciled ${account.name} from ${formatCurrency(currentBalance)} to ${formatCurrency(actualBalance)}`

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: isExpense ? 'EXPENSE' : 'INCOME',
          amount,
          name: transactionName,
          description,
          date,
          managedPayment: false,
        },
      })

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: { balance: actualBalance },
      })

      return { account: updatedAccount, transaction }
    })

    return NextResponse.json(toJson(result), { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PaymentError ? error.message : 'Unable to reconcile balance' },
      { status: error instanceof PaymentError ? error.status : 500 }
    )
  }
}
