import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { z } from 'zod'

const paySchema = z.object({ dueDate: z.string().date(), amount: z.number().finite().positive(), accountId: z.string().optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = paySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const data = parsed.data
  try {
    const result = await atomic(async tx => {
      const plan = await tx.paymentPlan.findFirst({ where: { id, userId: session.user.id, isActive: true } })
      if (!plan) throw new PaymentError('Payment plan not found', 404)
      if (Number(plan.amount) !== data.amount) throw new PaymentError('Record the full planned amount. Use a card, loan, or debt record when you need partial-payment tracking.')
      const accountId = data.accountId || plan.accountId
      if (!accountId) throw new PaymentError('Choose the account used for this payment')
      if (!await tx.account.findFirst({ where: { id: accountId, userId: session.user.id, isActive: true } })) throw new PaymentError('Payment account not found', 404)
      const dueDate = new Date(`${data.dueDate}T12:00:00`)
      const existing = await tx.paymentPlanOccurrence.findUnique({ where: { paymentPlanId_dueDate: { paymentPlanId: id, dueDate } } })
      if (existing?.paidAt) throw new PaymentError('This scheduled payment is already recorded')
      const payment = existing
        ? await tx.paymentPlanOccurrence.update({ where: { id: existing.id }, data: { amount: data.amount, paidAt: new Date(), accountId } })
        : await tx.paymentPlanOccurrence.create({ data: { paymentPlanId: id, dueDate, amount: data.amount, paidAt: new Date(), accountId } })
      await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: data.amount } } })
      await tx.transaction.create({ data: { userId: session.user.id, accountId, type: 'EXPENSE', amount: data.amount, name: `Planned payment: ${plan.name}`, date: new Date(), managedPayment: true } })
      return payment
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to record payment' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
