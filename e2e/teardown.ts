// Removes the temporary users created by the end-to-end run.
import { createRequire } from 'node:module'
import path from 'node:path'

export default async function globalTeardown() {
  const require = createRequire(path.join(__dirname, '..', 'package.json'))
  try { process.loadEnvFile(path.join(__dirname, '..', '.env')) } catch { /* DATABASE_URL may already be set */ }
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try { await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-', endsWith: '@example.invalid' } } }) } finally { await prisma.$disconnect() }
}
