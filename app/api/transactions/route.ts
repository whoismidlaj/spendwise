import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { z } from 'zod'

export const quickTransactionSchema = z.object({
  mode: z.enum(['PAYMENT', 'INCOME', 'TRANSFER']),
  amount: z.number().finite().positive().multipleOf(0.01),
  name: z.string().trim().min(1).max(100),
  date: z.string().date(),
  occurredAt: z.string().datetime().optional(),
  accountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requestedLimit = Number(new URL(req.url).searchParams.get('limit') || 100)
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.floor(requestedLimit))) : 100
  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = quickTransactionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  try {
    const data = parsed.data
    const result = await atomic(async tx => {
      const date = data.occurredAt ? new Date(data.occurredAt) : new Date(`${data.date}T12:00:00`)
      if (data.mode === 'PAYMENT') {
        const usesAccount = Boolean(data.accountId)
        const usesCard = Boolean(data.creditCardId)
        if (usesAccount === usesCard) throw new PaymentError('Choose one bank account or card')

        if (data.accountId) {
          const account = await tx.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })
          if (!account) throw new PaymentError('Account not found', 404)
          const entry = await tx.transaction.create({ data: {
            userId: session.user.id, accountId: account.id, type: 'EXPENSE', amount: data.amount,
            name: data.name, date, managedPayment: false,
          } })
          await tx.account.update({ where: { id: account.id }, data: { balance: { decrement: data.amount } } })
          return entry
        }

        const card = await tx.creditCard.findFirst({ where: { id: data.creditCardId!, userId: session.user.id, isActive: true } })
        if (!card) throw new PaymentError('Card or pay later account not found', 404)
        const entry = await tx.transaction.create({ data: {
          userId: session.user.id, creditCardId: card.id, type: 'EXPENSE', amount: data.amount,
          name: data.name, date, managedPayment: false,
        } })
        await tx.creditCard.update({
          where: { id: card.id },
          data: {
            usedLimit: { increment: data.amount },
            ...(card.expectedDue !== null && { expectedDue: { increment: data.amount } }),
          },
        })
        return entry
      }

      if (data.mode === 'INCOME') {
        if (!data.accountId) throw new PaymentError('Choose the receiving account')
        const account = await tx.account.findFirst({ where: { id: data.accountId, userId: session.user.id, isActive: true } })
        if (!account) throw new PaymentError('Account not found', 404)
        const entry = await tx.transaction.create({ data: {
          userId: session.user.id, accountId: account.id, type: 'INCOME', amount: data.amount,
          name: data.name, date, managedPayment: false,
        } })
        await tx.account.update({ where: { id: account.id }, data: { balance: { increment: data.amount } } })
        return entry
      }

      if (!data.accountId || !data.toAccountId || data.accountId === data.toAccountId) {
        throw new PaymentError('Choose two different accounts')
      }
      const ownedAccounts = await tx.account.findMany({
        where: { id: { in: [data.accountId, data.toAccountId] }, userId: session.user.id, isActive: true },
        select: { id: true },
      })
      if (ownedAccounts.length !== 2) throw new PaymentError('Account not found', 404)
      const entry = await tx.transaction.create({ data: {
        userId: session.user.id, accountId: data.accountId, toAccountId: data.toAccountId,
        type: 'TRANSFER', amount: data.amount, name: data.name, date, managedPayment: false,
      } })
      await tx.account.update({ where: { id: data.accountId }, data: { balance: { decrement: data.amount } } })
      await tx.account.update({ where: { id: data.toAccountId }, data: { balance: { increment: data.amount } } })
      return entry
    })
    return NextResponse.json(toJson(result), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to save transaction' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
