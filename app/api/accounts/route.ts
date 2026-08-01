import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['BANK', 'WALLET', 'CASH']),
  balance: z.number().default(0),
  color: z.string().default('#01696f'),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(toJson(accounts))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const account = await prisma.account.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json(toJson(account), { status: 201 })
}
