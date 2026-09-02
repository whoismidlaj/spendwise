import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 1. Reverse old balance & credit card effect
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
  } else if (existing.creditCardId && existing.type === 'EXPENSE') {
    await prisma.creditCard.update({
      where: { id: existing.creditCardId },
      data: {
        usedLimit: { decrement: Number(existing.amount) },
        dueAmount: { decrement: Number(existing.amount) },
      },
    })
  }

  // 2. Parse & sanitize body
  const body = await req.json()
  const dataToUpdate: Record<string, any> = {}

  if (body.type !== undefined) dataToUpdate.type = body.type
  if (body.name !== undefined) dataToUpdate.name = body.name
  if (body.description !== undefined) dataToUpdate.description = body.description || null
  if (body.amount !== undefined) dataToUpdate.amount = Number(body.amount)
  if (body.date !== undefined) dataToUpdate.date = new Date(body.date)
  if ('accountId' in body) dataToUpdate.accountId = body.accountId || null
  if ('toAccountId' in body) dataToUpdate.toAccountId = body.toAccountId || null
  if ('creditCardId' in body) dataToUpdate.creditCardId = body.creditCardId || null
  if ('categoryId' in body) dataToUpdate.categoryId = body.categoryId || null

  const updated = await prisma.transaction.update({
    where: { id },
    data: dataToUpdate,
    include: {
      account: { select: { name: true, color: true } },
      toAccount: { select: { name: true, color: true } },
      creditCard: { select: { name: true, color: true } },
      category: { select: { name: true, icon: true, color: true } },
    },
  })

  // 3. Apply new balance & credit card effect
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
  } else if (updated.creditCardId && updated.type === 'EXPENSE') {
    await prisma.creditCard.update({
      where: { id: updated.creditCardId },
      data: {
        usedLimit: { increment: Number(updated.amount) },
        dueAmount: { increment: Number(updated.amount) },
      },
    })
  }

  return NextResponse.json(toJson(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverse balance & credit card effect
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
  } else if (existing.creditCardId && existing.type === 'EXPENSE') {
    await prisma.creditCard.update({
      where: { id: existing.creditCardId },
      data: {
        usedLimit: { decrement: Number(existing.amount) },
        dueAmount: { decrement: Number(existing.amount) },
      },
    })
  }

  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
