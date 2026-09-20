import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { PaymentError } from './payments'

export const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().finite().positive().multipleOf(0.01),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  date: z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date'),
  accountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
})

type Entry = {
  type: string; amount: number | Prisma.Decimal; accountId?: string | null;
  toAccountId?: string | null; creditCardId?: string | null; categoryId?: string | null
}

export async function validateTransaction(tx: Prisma.TransactionClient, userId: string, data: Entry) {
  if (data.creditCardId && (data.accountId || data.toAccountId || data.type !== 'EXPENSE')) {
    throw new PaymentError('Card and pay later purchases must be expenses with no bank account selected')
  }
  if (data.type !== 'TRANSFER' && data.toAccountId) throw new PaymentError('Only transfers can have a destination account')
  if (data.type === 'TRANSFER' && (!data.accountId || !data.toAccountId || data.accountId === data.toAccountId)) {
    throw new PaymentError('Select two different accounts for a transfer')
  }
  for (const id of [data.accountId, data.toAccountId].filter(Boolean)) {
    if (!await tx.account.findFirst({ where: { id: id!, userId, isActive: true } })) throw new PaymentError('Account not found')
  }
  if (data.creditCardId && !await tx.creditCard.findFirst({ where: { id: data.creditCardId, userId, isActive: true } })) throw new PaymentError('Card not found')
  if (data.categoryId && !await tx.category.findFirst({ where: { id: data.categoryId, userId } })) throw new PaymentError('Category not found')
}

export async function applyTransaction(tx: Prisma.TransactionClient, data: Entry, sign: 1 | -1) {
  const amount = Number(data.amount) * sign
  if (data.accountId) {
    await tx.account.update({ where: { id: data.accountId }, data: { balance: { increment: data.type === 'INCOME' ? amount : -amount } } })
  }
  if (data.type === 'TRANSFER' && data.toAccountId) {
    await tx.account.update({ where: { id: data.toAccountId }, data: { balance: { increment: amount } } })
  }
  // Purchases affect usage, never the issuer's statement or minimum payment.
  if (data.creditCardId && data.type === 'EXPENSE') {
    await tx.creditCard.update({ where: { id: data.creditCardId }, data: { usedLimit: { increment: amount } } })
  }
}
