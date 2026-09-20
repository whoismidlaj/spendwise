import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { cardSchema, cardBalanceError } from '@/lib/card-schema'

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
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid credit card data'
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }

  const balanceError = cardBalanceError(parsed.data)
  if (balanceError) return NextResponse.json({ error: balanceError }, { status: 400 })

  const card = await prisma.creditCard.create({
    data: { ...parsed.data, billDueDate: parsed.data.billDueDate ? new Date(parsed.data.billDueDate) : null, userId: session.user.id },
  })

  return NextResponse.json(toJson(card), { status: 201 })
}
