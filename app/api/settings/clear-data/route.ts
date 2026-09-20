import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete dependent payment and planning records before their accounts.
      await tx.paymentPlanOccurrence.deleteMany({ where: { paymentPlan: { userId } } })
      await tx.paymentPlan.deleteMany({ where: { userId } })
      await tx.incomeOccurrence.deleteMany({ where: { incomeSource: { userId } } })
      await tx.incomeSource.deleteMany({ where: { userId } })
      await tx.debtPayment.deleteMany({ where: { debt: { userId } } })
      await tx.debt.deleteMany({ where: { userId } })
      await tx.transaction.deleteMany({ where: { userId } })

      // 2. Delete accounts and cards
      await tx.creditCard.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })

    })

    return NextResponse.json({ success: true, message: 'All user data has been cleared.' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to clear data' }, { status: 500 })
  }
}
