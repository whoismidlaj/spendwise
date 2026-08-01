import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.transaction.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverse old balance effect
  if (existing.type === 'TRANSFER') {
    if (existing.accountId) {
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: Number(existing.amount) } },
      })
    }
    if (existing.toAccountId) {
      await prisma.account.update({
        where: { id: existing.toAccountId },
        data: { balance: { decrement: Number(existing.amount) } },
      })
    }
  } else if (existing.accountId) {
    const oldDelta =
      existing.type === 'INCOME'
        ? -Number(existing.amount)
        : existing.type === 'EXPENSE'
        ? Number(existing.amount)
        : 0
    if (oldDelta !== 0) {
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: oldDelta } },
      })
    }
  }

  const body = await req.json()
  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
    },
    include: {
      account: { select: { name: true, color: true } },
      toAccount: { select: { name: true, color: true } },
      category: { select: { name: true, icon: true, color: true } },
    },
  })

  // Apply new balance effect
  if (updated.type === 'TRANSFER') {
    if (updated.accountId) {
      await prisma.account.update({
        where: { id: updated.accountId },
        data: { balance: { decrement: Number(updated.amount) } },
      })
    }
    if (updated.toAccountId) {
      await prisma.account.update({
        where: { id: updated.toAccountId },
        data: { balance: { increment: Number(updated.amount) } },
      })
    }
  } else if (updated.accountId) {
    const newDelta =
      updated.type === 'INCOME'
        ? Number(updated.amount)
        : updated.type === 'EXPENSE'
        ? -Number(updated.amount)
        : 0
    if (newDelta !== 0) {
      await prisma.account.update({
        where: { id: updated.accountId },
        data: { balance: { increment: newDelta } },
      })
    }
  }

  return NextResponse.json(toJson(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.transaction.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverse balance effect
  if (existing.type === 'TRANSFER') {
    if (existing.accountId) {
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: Number(existing.amount) } },
      })
    }
    if (existing.toAccountId) {
      await prisma.account.update({
        where: { id: existing.toAccountId },
        data: { balance: { decrement: Number(existing.amount) } },
      })
    }
  } else if (existing.accountId) {
    const delta =
      existing.type === 'INCOME'
        ? -Number(existing.amount)
        : existing.type === 'EXPENSE'
        ? Number(existing.amount)
        : 0
    if (delta !== 0) {
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: delta } },
      })
    }
  }

  await prisma.transaction.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
