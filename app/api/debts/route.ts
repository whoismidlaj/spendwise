import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { resolveLoanSchedule } from '@/lib/loan-schedule'
import { debtFields, normalizeSchedule, scheduleError } from '@/lib/debt-schema'
import { z } from 'zod'

const debtSchema = z.object({
  ...debtFields,
  direction: debtFields.direction.default('BORROWED'),
  interestRate: debtFields.interestRate.default(0),
  isRecurring: debtFields.isRecurring.default(false),
  priority: debtFields.priority.default('MEDIUM'),
  paymentDate: debtFields.paymentDate.optional(),
  paymentAmount: debtFields.paymentAmount.optional(),
  totalInstallments: debtFields.totalInstallments.optional(),
  startDate: debtFields.startDate.optional(),
  totalRepaymentAmount: debtFields.totalRepaymentAmount.optional(),
  totalInterestAmount: debtFields.totalInterestAmount.optional(),
  installmentSchedule: debtFields.installmentSchedule.optional(),
  deadline: debtFields.deadline.optional(),
  description: debtFields.description.optional(),
  // Principal still owed when an existing loan is added (defaults to the original principal).
  remaining: z.number().finite().multipleOf(0.01).nonnegative().optional(),
  // Installments already paid before the loan was added; recorded without touching any account.
  paidInstallments: z.number().int().nonnegative().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const debts = await prisma.debt.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { payments: { orderBy: { paidDate: 'desc' } } },
  })

  return NextResponse.json(toJson(debts))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = debtSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues?.[0]?.message || 'Invalid debt data' }, { status: 400 })
    const { installmentSchedule, remaining, paidInstallments, ...fields } = parsed.data
    const invalidSchedule = scheduleError(installmentSchedule)
    if (invalidSchedule) return NextResponse.json({ error: invalidSchedule }, { status: 400 })
    if (remaining !== undefined && remaining > fields.amount) return NextResponse.json({ error: 'Principal outstanding cannot exceed the original principal' }, { status: 400 })

    const created = await atomic(async tx => {
      const debt = await tx.debt.create({
        data: {
          ...fields,
          ...(installmentSchedule ? { installmentSchedule: normalizeSchedule(installmentSchedule) } : {}),
          userId: session.user.id,
          remaining: remaining ?? fields.amount,
          deadline: fields.deadline ? new Date(fields.deadline) : null,
          startDate: fields.startDate ? new Date(fields.startDate) : null,
        },
      })
      if (!paidInstallments) return debt
      const schedule = resolveLoanSchedule(debt)
      if (paidInstallments > schedule.length) throw new PaymentError(`This loan has only ${schedule.length} installments`)
      const done = schedule.slice(0, paidInstallments)
      await tx.debtPayment.createMany({ data: done.map(item => ({
        debtId: debt.id, amount: item.amount, principalAmount: item.principal, interestAmount: item.interest,
        installmentNumber: item.number, scheduledDueDate: item.dueDate, paidDate: item.dueDate, accountId: null,
      })) })
      if (remaining !== undefined) return debt
      const principalPaid = done.reduce((total, item) => total + Math.round(item.principal * 100), 0) / 100
      return tx.debt.update({ where: { id: debt.id }, data: { remaining: Math.max(0, fields.amount - principalPaid), isActive: fields.amount - principalPaid > 0.005 } })
    })
    return NextResponse.json(toJson(created), { status: 201 })
  } catch (error: any) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
