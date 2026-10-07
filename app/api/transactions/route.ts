import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/request-auth'
import { prisma, toJson } from '@/lib/prisma'

// Read-only view of the internal ledger (balance changes made by payments, receipts and reconciliations).
// Transactions are never created or edited directly; payments, receipts and adjustments write them.
export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requestedLimit = Number(new URL(req.url).searchParams.get('limit') || 100)
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.floor(requestedLimit))) : 100
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: {
      account: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
      creditCard: { select: { id: true, name: true, bank: true, type: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
  return NextResponse.json(toJson({ transactions, total: transactions.length }))
}
