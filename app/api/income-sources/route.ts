import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const incomeSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['SALARY', 'FREELANCE', 'RENTAL', 'INTEREST', 'OTHER']).default('SALARY'),
  frequency: z.enum(['MONTHLY', 'WEEKLY', 'ONE_TIME']).default('MONTHLY'),
  payday: z.number().int().min(1).max(31).nullable().optional(),
  grossAmount: z.number().finite().nonnegative().nullable().optional(),
  expectedInHand: z.number().finite().positive(),
  defaultDeductions: z.number().finite().nonnegative().default(0),
  accountId: z.string().nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sources = await prisma.incomeSource.findMany({
    where: { userId: session.user.id, isActive: true },
    include: { account: { select: { id: true, name: true } }, occurrences: { orderBy: { expectedDate: 'desc' }, take: 12 } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(toJson(sources))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = incomeSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const data = parsed.data
  if (data.frequency !== 'ONE_TIME' && !data.payday) return NextResponse.json({ error: 'Choose an expected payday' }, { status: 400 })
  if (data.accountId && !await prisma.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })) {
    return NextResponse.json({ error: 'Receiving account not found' }, { status: 404 })
  }
  const source = await prisma.incomeSource.create({ data: { ...data, userId: session.user.id, accountId: data.accountId || null } })
  return NextResponse.json(toJson(source), { status: 201 })
}
