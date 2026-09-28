import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { authOptions } from './auth'
import { bearerToken, getMobileUserId } from './mobile-auth'

export async function getRequestUserId(req: NextRequest) {
  const mobileUserId = await getMobileUserId(bearerToken(req.headers.get('authorization')))
  if (mobileUserId) return mobileUserId
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}
