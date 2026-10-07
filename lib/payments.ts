import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export class PaymentError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// Retry conflicting writes so simultaneous repayments cannot overpay a balance.
export async function atomic<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 30))
        continue
      }
      throw error
    }
  }
}
