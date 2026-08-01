import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const debtSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERSONAL', 'LOAN', 'CREDIT_LINE', 'PAY_LATER']),
  amount: z.number().positive(),
  interestRate: z.number().nonnegative().default(0),
  isRecurring: z.boolean().default(false),
  paymentDate: z.number().min(1).max(31).nullable().optional(),
  paymentAmount: z.number().positive().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  description: z.string().nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const debts = await prisma.debt.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        orderBy: { paidDate: 'desc' }
      }
    }
  })

  return NextResponse.json(toJson(debts))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = debtSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const debtData = {
      ...parsed.data,
      userId: session.user.id,
      remaining: parsed.data.amount,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
    }

    const debt = await prisma.debt.create({
      data: debtData,
    })

    return NextResponse.json(toJson(debt), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
