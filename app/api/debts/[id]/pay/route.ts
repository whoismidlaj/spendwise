import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { resolveLoanSchedule, settledInstallments } from '@/lib/loan-schedule'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01),
  accountId: z.string().optional(),
  paidDate: z.string().date().optional(),
  installmentNumber: z.number().int().positive().optional(),
})

const cents = (value: number) => Math.round(value * 100)

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
      const record = await tx.debt.findFirst({ where: { id, userId: session.user.id, isActive: true }, include: { payments: true } })
      if (!record) throw new PaymentError('Record not found', 404)
      if (accountId && !await tx.account.findFirst({ where: { id: accountId, userId: session.user.id, isActive: true } })) {
        throw new PaymentError('Account not found', 404)
      }

      // Resolve the scheduled installment first; only its principal part reduces the balance.
      const schedule = resolveLoanSchedule(record)
      const settled = settledInstallments(schedule, record.payments)
      let installment = schedule.find(item => parsed.data.installmentNumber ? item.number === parsed.data.installmentNumber : !settled.has(item.number))
      if (parsed.data.installmentNumber && !installment) throw new PaymentError('Installment not found', 404)
      if (installment && settled.has(installment.number)) throw new PaymentError('This installment is already paid')

      const remainingCents = cents(Number(record.remaining))
      let principalCents: number
      if (installment) {
        // The final EMI may exceed remaining principal because it includes interest.
        if (cents(amount) > cents(installment.amount)) throw new PaymentError('Payment exceeds the scheduled installment')
        principalCents = Math.min(remainingCents, Math.max(0, cents(amount) - cents(installment.interest)))
      } else {
        if (cents(amount) > remainingCents) throw new PaymentError('Repayment exceeds the remaining balance')
        principalCents = cents(amount)
      }
      const principalAmount = principalCents / 100
      const interestAmount = (cents(amount) - principalCents) / 100

      const received = record.direction === 'LENT'
      let transactionId: string | null = null
      // Principal repayments move money without counting spending twice or inflating income.
      if (accountId) {
        const ledger = await tx.transaction.create({
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
        transactionId = ledger.id
        await tx.account.update({ where: { id: accountId }, data: { balance: { increment: received ? amount : -amount } } })
      }
      const payment = await tx.debtPayment.create({
        data: {
          debtId: id, amount, principalAmount, interestAmount, accountId: accountId || null, paidDate, transactionId,
          installmentNumber: installment?.number ?? null, scheduledDueDate: installment?.dueDate ?? null,
        },
      })
      const updated = await tx.debt.update({
        where: { id },
        data: { remaining: { decrement: principalAmount }, isActive: remainingCents > principalCents },
      })
      return { updatedDebt: updated, payment }
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    // The unique (debtId, installmentNumber) index rejects a duplicate that slips past the check.
    if ((error as any)?.code === 'P2002') return NextResponse.json({ error: 'This installment is already paid' }, { status: 400 })
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
      await tx.debt.update({ where: { id }, data: { remaining: { increment: payment.principalAmount ?? payment.amount }, isActive: true } })
      if (payment.accountId) {
        // Money received from a borrower leaves the account again; money paid out returns to it.
        const received = record.direction === 'LENT'
        await tx.account.update({ where: { id: payment.accountId }, data: { balance: { increment: received ? payment.amount.negated() : payment.amount } } })
        const ledger = payment.transactionId
          // Legacy payments have no link, so fall back to the old name/amount match.
          ? await tx.transaction.findFirst({ where: { id: payment.transactionId, userId: session.user.id } })
          : await tx.transaction.findFirst({ where: { userId: session.user.id, managedPayment: true, type: 'TRANSFER', amount: payment.amount, name: `${received ? 'Repayment received' : 'Payment'}: ${record.name}`, ...(received ? { toAccountId: payment.accountId } : { accountId: payment.accountId }) }, orderBy: { createdAt: 'desc' } })
        if (ledger) await tx.transaction.delete({ where: { id: ledger.id } })
      }
      return { success: true }
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to undo payment' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
