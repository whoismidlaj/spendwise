import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { transactionSchema, validateTransaction, applyTransaction } from '@/lib/transaction-effects'
import { atomic, PaymentError } from '@/lib/payments'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const creditCardId = searchParams.get('creditCardId')
  const categoryId = searchParams.get('categoryId')
  const type = searchParams.get('type')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const where: Record<string, unknown> = { userId: session.user.id }
  if (accountId) where.accountId = accountId
  if (creditCardId) where.creditCardId = creditCardId
  if (categoryId) where.categoryId = categoryId
  if (type && type !== 'ALL') where.type = type
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (startDate || endDate) {
    where.date = {}
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate)
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate)
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: { select: { name: true, color: true } },
        toAccount: { select: { name: true, color: true } },
        creditCard: { select: { name: true, color: true } },
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions: toJson(transactions), total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const parsed = transactionSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const data = parsed.data
    const result = await atomic(async tx => {
      await validateTransaction(tx, session.user.id, data)
      const entry = await tx.transaction.create({ data: {
        ...data, userId: session.user.id, date: new Date(data.date),
        accountId: data.accountId || null, toAccountId: data.toAccountId || null,
        creditCardId: data.creditCardId || null, categoryId: data.categoryId || null,
      } })
      await applyTransaction(tx, entry, 1)
      return entry
    })
    return NextResponse.json(toJson(result), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to save transaction' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
