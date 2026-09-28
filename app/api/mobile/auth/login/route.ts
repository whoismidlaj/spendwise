import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma, toJson } from '@/lib/prisma'
import { createMobileSession } from '@/lib/mobile-auth'
import { z } from 'zod'

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await createMobileSession(user.id)
  return NextResponse.json(toJson({
    token: session.token,
    expiresAt: session.expiresAt,
    user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
  }))
}
