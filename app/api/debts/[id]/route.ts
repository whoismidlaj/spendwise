import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { debtFields, normalizeSchedule, scheduleError } from '@/lib/debt-schema'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const debtUpdateSchema = z.object({
  direction: debtFields.direction,
  name: debtFields.name,
  type: debtFields.type,
  amount: debtFields.amount,
  remaining: z.number().finite().multipleOf(0.01).nonnegative(),
  interestRate: debtFields.interestRate,
  isRecurring: debtFields.isRecurring,
  paymentDate: debtFields.paymentDate,
  paymentAmount: debtFields.paymentAmount,
  totalInstallments: debtFields.totalInstallments,
  startDate: debtFields.startDate,
  totalRepaymentAmount: debtFields.totalRepaymentAmount,
  totalInterestAmount: debtFields.totalInterestAmount,
  installmentSchedule: debtFields.installmentSchedule,
  deadline: debtFields.deadline,
  priority: debtFields.priority,
  description: debtFields.description,
  isActive: z.boolean(),
}).partial()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await prisma.debt.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Debt not found' }, { status: 404 })

    const body = await req.json()
    const parsed = debtUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid debt data'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    if (parsed.data.direction && parsed.data.direction !== existing.direction) {
      const payments = await prisma.debtPayment.count({ where: { debtId: id } })
      if (payments > 0) return NextResponse.json({ error: 'Direction cannot change after recording repayments' }, { status: 400 })
    }
    const invalidSchedule = scheduleError(parsed.data.installmentSchedule)
    if (invalidSchedule) return NextResponse.json({ error: invalidSchedule }, { status: 400 })
    const updateData: any = { ...parsed.data }
    if (parsed.data.installmentSchedule) {
      // Paid installments keep their stored numbers, so a schedule edit must not renumber rows.
      const paidNumbers = await prisma.debtPayment.count({ where: { debtId: id, installmentNumber: { not: null } } })
      if (paidNumbers > 0 && parsed.data.installmentSchedule.length < paidNumbers) return NextResponse.json({ error: 'The schedule cannot be shorter than the installments already paid' }, { status: 400 })
      updateData.installmentSchedule = normalizeSchedule(parsed.data.installmentSchedule)
    } else if (parsed.data.installmentSchedule === null) updateData.installmentSchedule = Prisma.DbNull
    if (parsed.data.deadline !== undefined) {
      updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null
    }
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null
    }

    if (parsed.data.remaining !== undefined) updateData.isActive = parsed.data.remaining > 0
    const updated = await prisma.debt.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(toJson(updated))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.debt.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.debt.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
