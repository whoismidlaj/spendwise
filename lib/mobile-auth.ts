import { createHash, randomBytes } from 'crypto'
import { prisma } from './prisma'

const MOBILE_SESSION_DAYS = 90

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createMobileSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.mobileSession.create({ data: { userId, tokenHash: hashToken(token), expiresAt } })
  return { token, expiresAt }
}

export async function getMobileUserId(token: string | null) {
  if (!token) return null
  const session = await prisma.mobileSession.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!session) return null
  if (session.expiresAt <= new Date()) {
    await prisma.mobileSession.delete({ where: { id: session.id } })
    return null
  }
  return session.userId
}

export async function revokeMobileSession(token: string | null) {
  if (!token) return
  await prisma.mobileSession.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export function bearerToken(value: string | null) {
  if (!value?.startsWith('Bearer ')) return null
  return value.slice('Bearer '.length).trim() || null
}
