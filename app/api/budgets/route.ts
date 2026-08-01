import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const budgets = await prisma.budget.findMany({
    where: { userId: session.user.id, month: now.getMonth() + 1, year: now.getFullYear() },
    include: { category: true },
  })

  return NextResponse.json(toJson(budgets))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { categoryId, amount, month, year } = body

  const now = new Date()
  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_month_year: {
        userId: session.user.id,
        categoryId,
        month: month ?? now.getMonth() + 1,
        year: year ?? now.getFullYear(),
      },
    },
    create: {
      userId: session.user.id,
      categoryId,
      amount,
      month: month ?? now.getMonth() + 1,
      year: year ?? now.getFullYear(),
    },
    update: { amount },
  })

  return NextResponse.json(toJson(budget))
}
