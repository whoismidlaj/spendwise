import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const item = await prisma.recurringExpense.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newPaidEMIs = item.paidEMIs + 1

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: session.user.id,
      accountId: item.accountId,
      type: 'EXPENSE',
      amount: item.emiAmount,
      name: `${item.name} - EMI #${newPaidEMIs}`,
      date: new Date(),
    },
  })

  // Deduct from account
  if (item.accountId) {
    await prisma.account.update({
      where: { id: item.accountId },
      data: { balance: { decrement: Number(item.emiAmount) } },
    })
  }

  // Create payment record
  await prisma.eMIPayment.create({
    data: {
      recurringExpenseId: item.id,
      amount: item.emiAmount,
      paidDate: new Date(),
      emiNumber: newPaidEMIs,
    },
  })

  // Update paidEMIs
  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: { paidEMIs: newPaidEMIs },
    include: { account: { select: { name: true } } },
  })

  return NextResponse.json(toJson(updated))
}
