import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { paymentPlanSchema } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.paymentPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  const parsed = paymentPlanSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (parsed.data.accountId && !await prisma.account.findFirst({ where: { id: parsed.data.accountId, userId: session.user.id, isActive: true } })) return NextResponse.json({ error: 'Payment account not found' }, { status: 404 })
  const updated = await prisma.paymentPlan.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.accountId !== undefined && { accountId: parsed.data.accountId || null }),
      ...(parsed.data.startDate !== undefined && { startDate: new Date(parsed.data.startDate) }),
    },
  })
  return NextResponse.json(toJson(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.paymentPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  await prisma.paymentPlan.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
