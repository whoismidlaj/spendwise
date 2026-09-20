import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { transactionSchema, validateTransaction, applyTransaction } from '@/lib/transaction-effects'

async function mutate(req: NextRequest, params: Promise<{ id: string }>, remove: boolean) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const body = remove ? null : await req.json()
    const result = await atomic(async tx => {
      const existing = await tx.transaction.findFirst({ where: { id, userId: session.user.id } })
      if (!existing) throw new PaymentError('Transaction not found', 404)
      if (existing.managedPayment) throw new PaymentError('This entry records a repayment and cannot be edited or deleted independently')
      if (remove) {
        await applyTransaction(tx, existing, -1)
        await tx.transaction.delete({ where: { id } })
        return { success: true }
      }
      const parsed = transactionSchema.safeParse({ ...existing, amount: Number(existing.amount), date: existing.date.toISOString(), ...body })
      if (!parsed.success) throw new PaymentError(parsed.error.issues[0].message)
      const data = parsed.data
      await validateTransaction(tx, session.user.id, data)
      await applyTransaction(tx, existing, -1)
      const updated = await tx.transaction.update({ where: { id }, data: {
        ...data, date: new Date(data.date), accountId: data.accountId || null,
        toAccountId: data.toAccountId || null, creditCardId: data.creditCardId || null, categoryId: data.categoryId || null,
      } })
      await applyTransaction(tx, updated, 1)
      return updated
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to update transaction' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutate(req, params, false)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutate(req, params, true)
}
