import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

export const paymentPlanSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['RENT', 'UTILITY', 'SUBSCRIPTION', 'INSURANCE', 'FAMILY', 'SAVINGS', 'OTHER']).default('OTHER'),
  amount: z.number().finite().positive(),
  dueDay: z.number().int().min(1).max(31),
  isEssential: z.boolean().default(true),
  accountId: z.string().nullable().optional(),
  startDate: z.string().date().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plans = await prisma.paymentPlan.findMany({ where: { userId: session.user.id, isActive: true }, include: { account: { select: { id: true, name: true } } }, orderBy: { dueDay: 'asc' } })
  return NextResponse.json(toJson(plans))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = paymentPlanSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const data = parsed.data
  if (data.accountId && !await prisma.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })) return NextResponse.json({ error: 'Payment account not found' }, { status: 404 })
  const plan = await prisma.paymentPlan.create({ data: { ...data, accountId: data.accountId || null, startDate: data.startDate ? new Date(data.startDate) : new Date(), userId: session.user.id } })
  return NextResponse.json(toJson(plan), { status: 201 })
}
