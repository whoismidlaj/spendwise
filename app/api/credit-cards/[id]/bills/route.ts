import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

// Statement-cycle history: each bill with its payments, newest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const card = await prisma.creditCard.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bills = await prisma.cardBill.findMany({ where: { creditCardId: id }, include: { payments: { orderBy: { paidDate: 'desc' } } }, orderBy: { dueDate: 'desc' } })
  return NextResponse.json(toJson(bills))
}
