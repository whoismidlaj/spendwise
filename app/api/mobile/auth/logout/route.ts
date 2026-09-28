import { NextRequest, NextResponse } from 'next/server'
import { bearerToken, revokeMobileSession } from '@/lib/mobile-auth'

export async function POST(req: NextRequest) {
  await revokeMobileSession(bearerToken(req.headers.get('authorization')))
  return NextResponse.json({ success: true })
}
