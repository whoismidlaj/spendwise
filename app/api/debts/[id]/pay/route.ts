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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    if (!body?.paymentId || typeof body.paymentId !== 'string') return NextResponse.json({ error: 'Payment id is required' }, { status: 400 })
    const result = await atomic(async tx => {
      const record = await tx.debt.findFirst({ where: { id, userId: session.user.id } })
      if (!record) throw new PaymentError('Record not found', 404)
      const payment = await tx.debtPayment.findFirst({ where: { id: body.paymentId, debtId: id } })
      if (!payment) throw new PaymentError('Payment not found', 404)
      await tx.debtPayment.delete({ where: { id: payment.id } })
      await tx.debt.update({ where: { id }, data: { remaining: { increment: payment.amount }, isActive: true } })
      if (payment.accountId) {
        await tx.account.update({ where: { id: payment.accountId }, data: { balance: { increment: payment.amount } } })
        const transaction = await tx.transaction.findFirst({ where: { userId: session.user.id, accountId: payment.accountId, managedPayment: true, type: 'TRANSFER', amount: payment.amount, name: `Payment: ${record.name}` }, orderBy: { createdAt: 'desc' } })
        if (transaction) await tx.transaction.delete({ where: { id: transaction.id } })
      }
      return { success: true }
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to undo payment' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
