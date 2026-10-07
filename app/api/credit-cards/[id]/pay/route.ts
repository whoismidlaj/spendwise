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
  // Due date of the statement cycle this payment settles.
  dueDate: z.string().date().optional(),
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
      const record = await tx.creditCard.findFirst({ where: { id, userId: session.user.id, isActive: true } })
      if (!record) throw new PaymentError('Record not found', 404)
      if (accountId && !await tx.account.findFirst({ where: { id: accountId, userId: session.user.id, isActive: true } })) {
        throw new PaymentError('Account not found', 404)
      }
      const currentUsed = Number(record.usedLimit)
      if (amount > currentUsed) throw new PaymentError('Payment exceeds the outstanding balance')
      const usedDelta = amount
      const dueDelta = Math.min(amount, Number(record.dueAmount))
      const minimumDelta = Math.min(amount, Number(record.minimumDue))
      const expectedDelta = record.expectedDue === null ? 0 : Math.min(amount, Number(record.expectedDue))
      const updated = await tx.creditCard.update({
        where: { id },
        data: {
          usedLimit: { decrement: usedDelta },
          dueAmount: { decrement: dueDelta },
          minimumDue: { decrement: minimumDelta },
          expectedDue: record.expectedDue === null ? null : { decrement: expectedDelta },
        },
      })

      // Statement cycle record: snapshotted at first payment so each month's bill stays reproducible.
      const dueKey = parsed.data.dueDate ?? (record.billDueDate ? record.billDueDate.toISOString().slice(0, 10) : null)
      let bill = null
      if (dueKey) {
        const dueDate = new Date(`${dueKey}T12:00:00`)
        const statementAmount = Number(record.dueAmount) > 0 ? Number(record.dueAmount) : Number(record.expectedDue ?? record.usedLimit)
        bill = await tx.cardBill.upsert({
          where: { creditCardId_dueDate: { creditCardId: id, dueDate } },
          create: { creditCardId: id, dueDate, statementAmount, minimumDue: record.minimumDue, paidAmount: 0 },
          update: {},
        })
        const paidAmount = Number(bill.paidAmount) + amount
        bill = await tx.cardBill.update({ where: { id: bill.id }, data: { paidAmount, paidAt: paidAmount >= Number(bill.statementAmount) ? paidDate : null } })
      }

      // Card bills move money out of the bank without counting spending twice.
      let transactionId: string | null = null
      if (accountId) {
        const ledger = await tx.transaction.create({
          data: { userId: session.user.id, accountId, type: 'TRANSFER', managedPayment: true, amount, name: `Payment: ${record.name}`, date: paidDate, creditCardId: id },
        })
        transactionId = ledger.id
        await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } })
      }
      await tx.cardPayment.create({
        data: { creditCardId: id, cardBillId: bill?.id ?? null, amount, paidDate, accountId: accountId || null, transactionId, usedDelta, dueDelta, minimumDelta, expectedDelta },
      })
      return updated
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
  const body = z.object({ paymentId: z.string().optional(), dueDate: z.string().date().optional() }).safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
  try {
    const result = await atomic(async tx => {
      const card = await tx.creditCard.findFirst({ where: { id, userId: session.user.id } })
      if (!card) throw new PaymentError('Record not found', 404)
      const payment = await tx.cardPayment.findFirst({
        where: body.data.paymentId ? { id: body.data.paymentId, creditCardId: id } : { creditCardId: id, cardBill: body.data.dueDate ? { dueDate: new Date(`${body.data.dueDate}T12:00:00`) } : undefined },
        orderBy: { createdAt: 'desc' },
      })
      if (!payment) throw new PaymentError('Payment not found', 404)
      const updated = await tx.creditCard.update({
        where: { id },
        data: {
          usedLimit: { increment: payment.usedDelta }, dueAmount: { increment: payment.dueDelta }, minimumDue: { increment: payment.minimumDelta },
          ...(card.expectedDue !== null ? { expectedDue: { increment: payment.expectedDelta } } : {}),
        },
      })
      if (payment.accountId) await tx.account.update({ where: { id: payment.accountId }, data: { balance: { increment: payment.amount } } })
      if (payment.transactionId) await tx.transaction.deleteMany({ where: { id: payment.transactionId, userId: session.user.id } })
      if (payment.cardBillId) {
        const bill = await tx.cardBill.findUnique({ where: { id: payment.cardBillId } })
        if (bill) {
          const paidAmount = Math.max(0, Number(bill.paidAmount) - Number(payment.amount))
          await tx.cardBill.update({ where: { id: bill.id }, data: { paidAmount, paidAt: null } })
        }
      }
      await tx.cardPayment.delete({ where: { id: payment.id } })
      return updated
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to undo payment' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
