import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01),
  accountId: z.string().optional(),
  paidDate: z.string().date().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const parsed = paymentSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { amount, accountId } = parsed.data
    const paidDate = parsed.data.paidDate ? new Date(parsed.data.paidDate) : new Date()
    const result = await atomic(async tx => {
      const record = await tx.debt.findFirst({ where: { id, userId: session.user.id, isActive: true } })
      if (!record) throw new PaymentError('Record not found', 404)
      if (accountId && !await tx.account.findFirst({ where: { id: accountId, userId: session.user.id, isActive: true } })) {
        throw new PaymentError('Account not found', 404)
      }
      if (amount > Number(record.remaining)) throw new PaymentError('Repayment exceeds the remaining balance')
      const updated = await tx.debt.update({
        where: { id },
        data: { remaining: { decrement: amount }, isActive: Number(record.remaining) > amount },
      })
      const payment = await tx.debtPayment.create({
        data: { debtId: id, amount, accountId: accountId || null, paidDate },
      })
      const received = record.direction === 'LENT'

      // Principal repayments move money without counting spending twice or inflating income.
      if (accountId) {
        await tx.transaction.create({
          data: {
            userId: session.user.id,
            accountId: received ? null : accountId,
            toAccountId: received ? accountId : null,
            type: 'TRANSFER',
            managedPayment: true,
            amount,
            name: `${received ? 'Repayment received' : 'Payment'}: ${record.name}`,
            date: paidDate,
          },
        })
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: received ? amount : -amount } },
        })
      }
      return { updatedDebt: updated, payment }
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to record payment' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
