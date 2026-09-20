import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { quickTransactionSchema } from '../route'

type TransactionRecord = Prisma.TransactionGetPayload<Record<string, never>>
type QuickTransaction = ReturnType<typeof quickTransactionSchema.parse>

async function validateDestination(tx: Prisma.TransactionClient, userId: string, data: QuickTransaction) {
  if (data.mode === 'PAYMENT') {
    const usesAccount = Boolean(data.accountId)
    const usesCard = Boolean(data.creditCardId)
    if (usesAccount === usesCard) throw new PaymentError('Choose one bank account or card')

    if (data.accountId && !await tx.account.findFirst({ where: { id: data.accountId, userId, isActive: true } })) {
      throw new PaymentError('Account not found', 404)
    }
    if (data.creditCardId && !await tx.creditCard.findFirst({ where: { id: data.creditCardId, userId, isActive: true } })) {
      throw new PaymentError('Card or pay later account not found', 404)
    }
    return
  }

  if (!data.accountId || !data.toAccountId || data.accountId === data.toAccountId) {
    throw new PaymentError('Choose two different accounts')
  }
  const accounts = await tx.account.count({
    where: { id: { in: [data.accountId, data.toAccountId] }, userId, isActive: true },
  })
  if (accounts !== 2) throw new PaymentError('Account not found', 404)
}

async function reverseEffect(tx: Prisma.TransactionClient, entry: TransactionRecord) {
  const amount = Number(entry.amount)
  if (entry.type === 'EXPENSE') {
    if (entry.accountId) {
      await tx.account.update({ where: { id: entry.accountId }, data: { balance: { increment: amount } } })
    }
    if (entry.creditCardId) {
      const card = await tx.creditCard.findUnique({ where: { id: entry.creditCardId } })
      if (card) {
        await tx.creditCard.update({
          where: { id: card.id },
          data: {
            usedLimit: Math.max(0, Number(card.usedLimit) - amount),
            expectedDue: card.expectedDue === null ? null : Math.max(0, Number(card.expectedDue) - amount),
          },
        })
      }
    }
    return
  }

  if (entry.type === 'TRANSFER') {
    if (entry.accountId) {
      await tx.account.update({ where: { id: entry.accountId }, data: { balance: { increment: amount } } })
    }
    if (entry.toAccountId) {
      await tx.account.update({ where: { id: entry.toAccountId }, data: { balance: { decrement: amount } } })
    }
  }
}

async function applyEffect(tx: Prisma.TransactionClient, data: QuickTransaction) {
  if (data.mode === 'PAYMENT') {
    if (data.accountId) {
      await tx.account.update({ where: { id: data.accountId }, data: { balance: { decrement: data.amount } } })
      return
    }
    const card = await tx.creditCard.findUnique({ where: { id: data.creditCardId! } })
    if (!card) throw new PaymentError('Card or pay later account not found', 404)
    await tx.creditCard.update({
      where: { id: card.id },
      data: {
        usedLimit: { increment: data.amount },
        ...(card.expectedDue !== null && { expectedDue: { increment: data.amount } }),
      },
    })
    return
  }

  await tx.account.update({ where: { id: data.accountId! }, data: { balance: { decrement: data.amount } } })
  await tx.account.update({ where: { id: data.toAccountId! }, data: { balance: { increment: data.amount } } })
}

function errorResponse(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: error instanceof PaymentError ? error.message : fallback },
    { status: error instanceof PaymentError ? error.status : 500 },
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = quickTransactionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { id } = await params

  try {
    const updated = await atomic(async tx => {
      const existing = await tx.transaction.findFirst({ where: { id, userId: session.user.id } })
      if (!existing) throw new PaymentError('Transaction not found', 404)
      if (existing.managedPayment) throw new PaymentError('Automatic entries must be changed from their original bill, loan, card, or income record')
      if (existing.type === 'INCOME') throw new PaymentError('This income entry must be changed from Income')

      const data = parsed.data
      await validateDestination(tx, session.user.id, data)
      await reverseEffect(tx, existing)
      await applyEffect(tx, data)
      const date = data.occurredAt ? new Date(data.occurredAt) : new Date(`${data.date}T12:00:00`)
      return tx.transaction.update({
        where: { id },
        data: {
          type: data.mode === 'TRANSFER' ? 'TRANSFER' : 'EXPENSE',
          amount: data.amount,
          name: data.name,
          date,
          accountId: data.mode === 'TRANSFER' || data.accountId ? data.accountId : null,
          creditCardId: data.mode === 'PAYMENT' ? data.creditCardId || null : null,
          toAccountId: data.mode === 'TRANSFER' ? data.toAccountId : null,
        },
      })
    })
    return NextResponse.json(toJson(updated))
  } catch (error) {
    return errorResponse(error, 'Unable to update transaction')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await atomic(async tx => {
      const existing = await tx.transaction.findFirst({ where: { id, userId: session.user.id } })
      if (!existing) throw new PaymentError('Transaction not found', 404)
      if (existing.managedPayment) throw new PaymentError('Automatic entries must be changed from their original bill, loan, card, or income record')
      if (existing.type === 'INCOME') throw new PaymentError('This income entry must be changed from Income')
      await reverseEffect(tx, existing)
      await tx.transaction.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Unable to delete transaction')
  }
}
