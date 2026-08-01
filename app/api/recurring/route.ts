import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const recurringSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['EMI', 'LOAN', 'SUBSCRIPTION', 'UTILITY', 'RENT', 'OTHER']),
  loanAmount: z.number().optional().nullable(),
  interestRate: z.number().optional().nullable(),
  additionalFees: z.number().optional().nullable(),
  emiAmount: z.number().positive(),
  emiDate: z.number().min(1).max(31),
  totalEMIs: z.number().optional().nullable(),
  startDate: z.string(),
  accountId: z.string().optional().nullable(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await prisma.recurringExpense.findMany({
    where: { userId: session.user.id, isActive: true },
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(toJson(items))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = recurringSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const item = await prisma.recurringExpense.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      startDate: new Date(parsed.data.startDate),
    },
  })

  return NextResponse.json(toJson(item), { status: 201 })
}
