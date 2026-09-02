import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const paySchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = paySchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid payment data'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const { amount, accountId } = parsed.data

    const card = await prisma.creditCard.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!card) return NextResponse.json({ error: 'Credit card not found' }, { status: 404 })

    const currentDue = Number(card.dueAmount)
    const currentUsed = Number(card.usedLimit)
    const newDueAmount = Math.max(0, currentDue - amount)
    const newUsedLimit = Math.max(0, currentUsed - amount)

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update Card due and used limits
      const updatedCard = await tx.creditCard.update({
        where: { id },
        data: {
          dueAmount: newDueAmount,
          usedLimit: newUsedLimit,
        },
      })

      // 2. If account provided, deduct and create transaction
      if (accountId) {
        const account = await tx.account.findFirst({
          where: { id: accountId, userId: session.user.id },
        })
        if (!account) throw new Error('Account not found')

        let category = await tx.category.findFirst({
          where: { userId: session.user.id, name: 'Bills & Utilities', type: 'EXPENSE' },
        })
        if (!category) {
          category = await tx.category.findFirst({
            where: { userId: session.user.id, type: 'EXPENSE' },
          })
        }

        await tx.transaction.create({
          data: {
            userId: session.user.id,
            accountId,
            categoryId: category?.id || null,
            type: 'EXPENSE',
            amount,
            name: `Credit Card Bill: ${card.bank} ${card.name}`,
            date: new Date(),
          },
        })

        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: { decrement: amount },
          },
        })
      }

      return updatedCard
    })

    return NextResponse.json(toJson(result))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
