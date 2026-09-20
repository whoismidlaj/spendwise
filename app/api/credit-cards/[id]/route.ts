import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { cardSchema, cardBalanceError } from '@/lib/card-schema'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const card = await prisma.creditCard.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = cardSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const balanceError = cardBalanceError({ usedLimit: Number(card.usedLimit), dueAmount: Number(card.dueAmount), minimumDue: Number(card.minimumDue), ...parsed.data })
  if (balanceError) return NextResponse.json({ error: balanceError }, { status: 400 })
  const { billDueDate, ...data } = parsed.data
  const updated = await prisma.creditCard.update({
    where: { id },
    data: { ...data, ...(billDueDate !== undefined ? { billDueDate: billDueDate ? new Date(billDueDate) : null } : {}) },
  })

  return NextResponse.json(toJson(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const card = await prisma.creditCard.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.creditCard.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
