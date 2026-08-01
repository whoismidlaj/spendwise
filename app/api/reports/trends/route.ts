import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') || '6')

  const now = new Date()
  const results = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: session.user.id, type: 'INCOME', date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: session.user.id, type: 'EXPENSE', date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ])

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    results.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      income: Number(income._sum.amount || 0),
      expense: Number(expense._sum.amount || 0),
    })
  }

  return NextResponse.json(toJson(results))
}
