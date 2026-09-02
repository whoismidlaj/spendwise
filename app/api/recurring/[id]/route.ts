import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const recurringUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['EMI', 'LOAN', 'SUBSCRIPTION', 'UTILITY', 'RENT', 'OTHER']).optional(),
  loanAmount: z.number().nullable().optional(),
  interestRate: z.number().nullable().optional(),
  additionalFees: z.number().nullable().optional(),
  emiAmount: z.number().positive().optional(),
  emiDate: z.number().min(1).max(31).optional(),
  totalEMIs: z.number().nullable().optional(),
  paidEMIs: z.number().min(0).optional(),
  startDate: z.string().optional(),
  accountId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const item = await prisma.recurringExpense.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const parsed = recurringUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid recurring expense data'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const updateData: any = { ...parsed.data }
    if (parsed.data.startDate) {
      updateData.startDate = new Date(parsed.data.startDate)
    }

    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: updateData,
      include: { account: { select: { id: true, name: true } } },
    })

    return NextResponse.json(toJson(updated))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const item = await prisma.recurringExpense.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.recurringExpense.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}

