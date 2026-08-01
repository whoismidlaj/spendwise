import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const txSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  date: z.string(),
  accountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
  creditCardId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
})

async function recalcAccountBalance(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) return

  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ])

  // We store the initial balance separately isn't tracked — we track running balance directly.
  // For simplicity: balance = (sum of all INCOME) - (sum of all EXPENSE) + initial seeded value
  // Since we don't have a separate initialBalance column, we just update balance based on delta
}

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

  const body = await req.json()
  const parsed = txSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const data = parsed.data

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: data.type,
      amount: data.amount,
      name: data.name,
      description: data.description,
      date: new Date(data.date),
      accountId: data.accountId || null,
      toAccountId: data.toAccountId || null,
      creditCardId: data.creditCardId || null,
      categoryId: data.categoryId || null,
    },
    include: {
      account: { select: { name: true, color: true } },
      toAccount: { select: { name: true, color: true } },
      category: { select: { name: true, icon: true, color: true } },
    },
  })

  // Update account balance
  if (data.type === 'TRANSFER') {
    if (data.accountId) {
      await prisma.account.update({
        where: { id: data.accountId },
        data: { balance: { decrement: data.amount } },
      })
    }
    if (data.toAccountId) {
      await prisma.account.update({
        where: { id: data.toAccountId },
        data: { balance: { increment: data.amount } },
      })
    }
  } else if (data.accountId) {
    const delta = data.type === 'INCOME' ? data.amount : data.type === 'EXPENSE' ? -data.amount : 0
    if (delta !== 0) {
      await prisma.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: delta } },
      })
    }
  }

  // Update credit card used limit
  if (data.creditCardId && data.type === 'EXPENSE') {
    await prisma.creditCard.update({
      where: { id: data.creditCardId },
      data: {
        usedLimit: { increment: data.amount },
        dueAmount: { increment: data.amount },
      },
    })
  }

  return NextResponse.json(toJson(tx), { status: 201 })
}
