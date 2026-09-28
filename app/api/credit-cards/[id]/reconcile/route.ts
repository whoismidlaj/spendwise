import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/request-auth'
import { prisma, toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { formatCurrency } from '@/lib/currency'
import { z } from 'zod'

const cardReconcileSchema = z.object({
  actualUsed: z.number().finite().min(0),
  note: z.string().trim().max(100).optional(),
  date: z.string().date().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = cardReconcileSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { actualUsed, note, date: dateStr } = parsed.data
  const date = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date()

  try {
    const result = await atomic(async tx => {
      const card = await tx.creditCard.findFirst({
        where: { id, userId, isActive: true },
      })
      if (!card) throw new PaymentError('Card or pay later account not found', 404)

      const currentUsed = Number(card.usedLimit)
      const diff = Math.round((actualUsed - currentUsed) * 100) / 100

      if (diff === 0) {
        return { card, transaction: null, message: 'Card usage is already up to date' }
      }

      const isExpense = diff > 0
      const amount = Math.abs(diff)
      const defaultName = isExpense ? 'Balance Adjustment (Card Spend)' : 'Balance Adjustment (Card Credit)'
      const transactionName = note || defaultName
      const description = `Reconciled ${card.name} usage from ${formatCurrency(currentUsed)} to ${formatCurrency(actualUsed)}`

      const transaction = await tx.transaction.create({
        data: {
          userId,
          creditCardId: card.id,
          type: isExpense ? 'EXPENSE' : 'INCOME',
          amount,
          name: transactionName,
          description,
          date,
          managedPayment: false,
        },
      })

      const updatedCard = await tx.creditCard.update({
        where: { id: card.id },
        data: {
          usedLimit: actualUsed,
          ...(card.expectedDue !== null && {
            expectedDue: isExpense
              ? Number(card.expectedDue) + amount
              : Math.max(0, Number(card.expectedDue) - amount),
          }),
          ...(!isExpense && {
            dueAmount: Math.min(Number(card.dueAmount), actualUsed),
            minimumDue: Math.min(Number(card.minimumDue), actualUsed),
          }),
        },
      })

      return { card: updatedCard, transaction }
    })

    return NextResponse.json(toJson(result), { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PaymentError ? error.message : 'Unable to reconcile card usage' },
      { status: error instanceof PaymentError ? error.status : 500 }
    )
  }
}
