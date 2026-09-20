import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const debtUpdateSchema = z.object({
  direction: z.enum(['BORROWED', 'LENT']).optional(),
  name: z.string().min(1).optional(),
  type: z.enum(['PERSONAL', 'LOAN', 'CREDIT_LINE', 'PAY_LATER']).optional(),
  amount: z.number().finite().multipleOf(0.01).positive().optional(),
  remaining: z.number().finite().multipleOf(0.01).nonnegative().optional(),
  interestRate: z.number().finite().multipleOf(0.01).nonnegative().optional(),
  isRecurring: z.boolean().optional(),
  paymentDate: z.number().int().min(1).max(31).nullable().optional(),
  paymentAmount: z.number().finite().multipleOf(0.01).positive().nullable().optional(),
  deadline: z.string().date().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

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
    const updateData: any = { ...parsed.data }
    if (parsed.data.deadline !== undefined) {
      updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null
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

