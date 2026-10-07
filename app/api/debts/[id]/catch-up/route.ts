import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { resolveLoanSchedule, settledInstallments } from '@/lib/loan-schedule'
import { z } from 'zod'

const bodySchema = z.object({ through: z.string().date() })

// Bulk-mark every unpaid installment due on or before a date as paid, without moving any account balance.
// Used to bring a loan that started earlier up to date.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const result = await atomic(async tx => {
      const debt = await tx.debt.findFirst({ where: { id, userId: session.user.id, isActive: true }, include: { payments: true } })
      if (!debt) throw new PaymentError('Record not found', 404)
      const schedule = resolveLoanSchedule(debt)
      if (!schedule.length) throw new PaymentError('This record has no installment schedule')
      const settled = settledInstallments(schedule, debt.payments)
      const due = schedule.filter(item => !settled.has(item.number) && item.dueDate.toISOString().slice(0, 10) <= parsed.data.through)
      if (!due.length) throw new PaymentError('No unpaid installments fall on or before that date')
      await tx.debtPayment.createMany({ data: due.map(item => ({
        debtId: id, amount: item.amount, principalAmount: item.principal, interestAmount: item.interest,
        installmentNumber: item.number, scheduledDueDate: item.dueDate, paidDate: item.dueDate, accountId: null,
      })) })
      const principalCents = due.reduce((total, item) => total + Math.round(item.principal * 100), 0)
      const remainingCents = Math.max(0, Math.round(Number(debt.remaining) * 100) - principalCents)
      const updated = await tx.debt.update({ where: { id }, data: { remaining: remainingCents / 100, isActive: remainingCents > 0 } })
      return { debt: updated, marked: due.length }
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to update the schedule' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
