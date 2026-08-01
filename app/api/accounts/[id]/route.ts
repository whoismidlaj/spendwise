import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.account.update({
    where: { id },
    data: body,
  })

  return NextResponse.json(toJson(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.account.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
