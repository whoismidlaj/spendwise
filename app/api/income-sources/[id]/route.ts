import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const incomeUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(['SALARY', 'FREELANCE', 'RENTAL', 'INTEREST', 'OTHER']).optional(),
  payday: z.number().int().min(1).max(31).optional(),
  grossAmount: z.number().finite().nonnegative().nullable().optional(),
  expectedInHand: z.number().finite().positive().optional(),
  defaultDeductions: z.number().finite().nonnegative().optional(),
  accountId: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = incomeUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const existing = await prisma.incomeSource.findFirst({ where: { id, userId: session.user.id, isActive: true } })
  if (!existing) return NextResponse.json({ error: 'Income source not found' }, { status: 404 })
  const data = parsed.data
  if (data.accountId && !await prisma.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })) return NextResponse.json({ error: 'Receiving account not found' }, { status: 404 })
  const source = await prisma.incomeSource.update({ where: { id }, data: { ...data, accountId: data.accountId === undefined ? undefined : data.accountId || null } })
  return NextResponse.json(toJson(source))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const source = await prisma.incomeSource.findFirst({ where: { id, userId: session.user.id, isActive: true } })
  if (!source) return NextResponse.json({ error: 'Income source not found' }, { status: 404 })
  await prisma.incomeSource.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
