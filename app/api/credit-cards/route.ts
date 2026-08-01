import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const cardSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  totalLimit: z.number().positive(),
  usedLimit: z.number().min(0).default(0),
  dueAmount: z.number().min(0).default(0),
  dueDate: z.number().min(1).max(31),
  statementDate: z.number().min(1).max(31),
  color: z.string().default('#006494'),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards = await prisma.creditCard.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(toJson(cards))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = cardSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const card = await prisma.creditCard.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(toJson(card), { status: 201 })
}
