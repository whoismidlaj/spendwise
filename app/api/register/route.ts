import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#ef4444' },
  { name: 'Groceries', icon: '🛒', color: '#f97316' },
  { name: 'Transport', icon: '🚌', color: '#eab308' },
  { name: 'Shopping', icon: '🛍', color: '#a855f7' },
  { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { name: 'Utilities', icon: '⚡', color: '#06b6d4' },
  { name: 'Health', icon: '💊', color: '#10b981' },
  { name: 'Education', icon: '📚', color: '#3b82f6' },
  { name: 'Travel', icon: '✈️', color: '#8b5cf6' },
  { name: 'Other', icon: '📌', color: '#6b7280' },
]

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#22c55e' },
  { name: 'Freelance', icon: '💻', color: '#14b8a6' },
  { name: 'Investment', icon: '📈', color: '#6366f1' },
  { name: 'Gift', icon: '🎁', color: '#f43f5e' },
  { name: 'Other Income', icon: '💰', color: '#84cc16' },
]

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  })

  // Seed default categories
  await Promise.all([
    ...DEFAULT_EXPENSE_CATEGORIES.map((cat) =>
      prisma.category.create({
        data: { ...cat, userId: user.id, type: 'EXPENSE', isSystem: true },
      })
    ),
    ...DEFAULT_INCOME_CATEGORIES.map((cat) =>
      prisma.category.create({
        data: { ...cat, userId: user.id, type: 'INCOME', isSystem: true },
      })
    ),
  ])

  return NextResponse.json({ success: true }, { status: 201 })
}
