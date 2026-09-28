import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/request-auth'
import { prisma, toJson } from '@/lib/prisma'
import { z } from 'zod'
import { inferInstitution, INSTITUTION_IDS } from '@/lib/institutions'

export const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['BANK', 'WALLET', 'CASH']),
  balance: z.number().default(0),
  color: z.string().default('#01696f'),
  institution: z.enum(INSTITUTION_IDS).default('OTHER'),
})

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storedAccounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const accounts = await Promise.all(storedAccounts.map(async account => {
    if (account.institution !== 'OTHER') return account
    const institution = inferInstitution(account.name, 'account')
    if (institution === 'OTHER') return account
    return prisma.account.update({ where: { id: account.id }, data: { institution } })
  }))

  return NextResponse.json(toJson(accounts))
}

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid account data'
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }

  const account = await prisma.account.create({
    data: { ...parsed.data, userId },
  })

  return NextResponse.json(toJson(account), { status: 201 })
}
