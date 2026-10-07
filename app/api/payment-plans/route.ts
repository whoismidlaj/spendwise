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
  endDate: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
  archived: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

// ?archived=1 returns every record; ?history=1 adds each record's paid occurrences.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const query = new URL(req.url).searchParams
  const plans = await prisma.paymentPlan.findMany({
    where: { userId: session.user.id, ...(query.get('archived') === '1' ? {} : { isActive: true, archivedAt: null }) },
    include: { account: { select: { id: true, name: true } }, ...(query.get('history') === '1' ? { payments: { where: { paidAt: { not: null } }, orderBy: { dueDate: 'desc' } } } : {}) },
    orderBy: { dueDay: 'asc' },
  })
  return NextResponse.json(toJson(plans))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = paymentPlanSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const data = parsed.data
  if (data.accountId && !await prisma.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })) return NextResponse.json({ error: 'Payment account not found' }, { status: 404 })
  const { archived, ...planData } = data
  const plan = await prisma.paymentPlan.create({ data: { ...planData, accountId: data.accountId || null, archivedAt: archived ? new Date() : null, startDate: data.startDate ? new Date(data.startDate) : new Date(), endDate: data.endDate ? new Date(data.endDate) : null, userId: session.user.id } })
  return NextResponse.json(toJson(plan), { status: 201 })
}
