import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const categorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(toJson(categories))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const category = await prisma.category.create({
    data: { ...parsed.data, userId: session.user.id, isSystem: false },
  })

  return NextResponse.json(toJson(category), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const cat = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (cat.isSystem) return NextResponse.json({ error: 'Cannot delete system category' }, { status: 400 })

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
