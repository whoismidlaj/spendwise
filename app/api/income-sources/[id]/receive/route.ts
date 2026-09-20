import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toJson } from '@/lib/prisma'
import { atomic, PaymentError } from '@/lib/payments'
import { z } from 'zod'

const receiveSchema = z.object({
  expectedDate: z.string().date(),
  amount: z.number().finite().positive(),
  receivedAt: z.string().date().optional(),
  accountId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = receiveSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const data = parsed.data
  try {
    const result = await atomic(async tx => {
      const source = await tx.incomeSource.findFirst({ where: { id, userId: session.user.id, isActive: true } })
      if (!source) throw new PaymentError('Income source not found', 404)
      const accountId = data.accountId || source.accountId
      if (!accountId) throw new PaymentError('Choose the account that received this income')
      const account = await tx.account.findFirst({ where: { id: accountId, userId: session.user.id, isActive: true } })
      if (!account) throw new PaymentError('Receiving account not found', 404)
      const expectedDate = new Date(`${data.expectedDate}T12:00:00`)
      const existing = await tx.incomeOccurrence.findUnique({ where: { incomeSourceId_expectedDate: { incomeSourceId: id, expectedDate } } })
      if (existing?.status === 'RECEIVED') throw new PaymentError('This income has already been recorded')
      const receivedAt = new Date(`${data.receivedAt || data.expectedDate}T12:00:00`)
      const occurrence = existing
        ? await tx.incomeOccurrence.update({ where: { id: existing.id }, data: { expectedAmount: source.expectedInHand, actualAmount: data.amount, receivedAt, status: 'RECEIVED', notes: data.notes || null } })
        : await tx.incomeOccurrence.create({ data: { incomeSourceId: id, expectedDate, expectedAmount: source.expectedInHand, actualAmount: data.amount, receivedAt, status: 'RECEIVED', notes: data.notes || null } })
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: data.amount } } })
      await tx.transaction.create({ data: { userId: session.user.id, accountId, type: 'INCOME', amount: data.amount, name: `Income received: ${source.name}`, description: data.notes || null, date: receivedAt, managedPayment: true } })
      return occurrence
    })
    return NextResponse.json(toJson(result))
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to record income' }, { status: error instanceof PaymentError ? error.status : 500 })
  }
}
