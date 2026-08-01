import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const { amount, accountId } = parsed.data

    const debt = await prisma.debt.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 })

    const newRemaining = Math.max(0, Number(debt.remaining) - amount)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update remaining balance of the debt
      const updatedDebt = await tx.debt.update({
        where: { id: params.id },
        data: {
          remaining: newRemaining,
          isActive: newRemaining > 0,
        },
      })

      // 2. Create the DebtPayment record
      const payment = await tx.debtPayment.create({
        data: {
          debtId: params.id,
          amount,
          accountId: accountId || null,
        },
      })

      // 3. If accountId is provided, deduct from account balance and record expense
      if (accountId) {
        const account = await tx.account.findFirst({
          where: { id: accountId, userId: session.user.id },
        })
        if (!account) throw new Error('Account not found')

        // Find or create a "Debt" category
        let category = await tx.category.findFirst({
          where: { userId: session.user.id, name: 'Debt Payment', type: 'EXPENSE' },
        })
        if (!category) {
          // Fallback to "Other"
          category = await tx.category.findFirst({
            where: { userId: session.user.id, name: 'Other', type: 'EXPENSE' },
          })
        }
        if (!category) {
          // Create "Debt Payment" category
          category = await tx.category.create({
            data: {
              userId: session.user.id,
              name: 'Debt Payment',
              icon: '💸',
              color: '#ef4444',
              type: 'EXPENSE',
            },
          })
        }

        // Create transaction
        await tx.transaction.create({
          data: {
            userId: session.user.id,
            accountId,
            categoryId: category.id,
            type: 'EXPENSE',
            amount,
            name: `Payment: ${debt.name}`,
            date: new Date(),
          },
        })

        // Decrement account balance
        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: { decrement: amount },
          },
        })
      }

      return { updatedDebt, payment }
    })

    return NextResponse.json(toJson(result))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
