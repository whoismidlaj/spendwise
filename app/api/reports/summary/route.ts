import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const dateFilter: Record<string, unknown> = {}
  if (startDate) dateFilter.gte = new Date(startDate)
  if (endDate) dateFilter.lte = new Date(endDate)

  const where = {
    userId: session.user.id,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
  }

  const [income, expense, byCategory] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...where, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ])

  const categoryIds = byCategory.map((b) => b.categoryId).filter(Boolean) as string[]
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
  })
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))

  const totalIncome = Number(income._sum.amount || 0)
  const totalExpense = Number(expense._sum.amount || 0)

  return NextResponse.json(
    toJson({
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      byCategory: byCategory.map((b) => ({
        categoryId: b.categoryId,
        name: catMap[b.categoryId!]?.name ?? 'Uncategorized',
        color: catMap[b.categoryId!]?.color ?? '#6b7280',
        icon: catMap[b.categoryId!]?.icon ?? '📌',
        total: Number(b._sum.amount || 0),
      })),
    })
  )
}
