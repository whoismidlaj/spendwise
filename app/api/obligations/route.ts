import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { now as currentTime } from '@/lib/clock'
import { loadObligations, OVERDUE_LOOKBACK_MONTHS } from '@/lib/obligations'

// Monthly checklist: every obligation due in the month (paid or not) plus earlier unpaid ones as overdue.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = currentTime()
  const month = new URL(req.url).searchParams.get('month')
  const match = month?.match(/^(\d{4})-(\d{2})$/)
  if (month && (!match || Number(match[2]) < 1 || Number(match[2]) > 12)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  const year = match ? Number(match[1]) : now.getFullYear()
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth()
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
  const lookbackStart = new Date(year, monthIndex - OVERDUE_LOOKBACK_MONTHS, 1)
  const all = await loadObligations(prisma, session.user.id, { from: lookbackStart, to: end, now })
  const items = all.filter(item => item.dueDate >= start || item.status === 'OVERDUE')
  const summary = {
    total: items.reduce((sum, item) => sum + item.amount, 0),
    paid: items.filter(item => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0),
    remaining: items.filter(item => item.status !== 'PAID').reduce((sum, item) => sum + item.amount, 0),
    overdueCount: items.filter(item => item.status === 'OVERDUE').length,
  }
  return NextResponse.json(toJson({ month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`, items, summary }))
}
