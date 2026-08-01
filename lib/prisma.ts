import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export function toJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, function (key, value) {
      if (this && this[key] instanceof Prisma.Decimal) {
        return this[key].toNumber()
      }
      return value
    })
  )
}
