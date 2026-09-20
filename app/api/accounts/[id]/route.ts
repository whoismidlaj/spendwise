import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { accountSchema } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = accountSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const updated = await prisma.account.update({
    where: { id },
    data: parsed.data,
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
