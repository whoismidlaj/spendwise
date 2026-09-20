import { z } from 'zod'
import { INSTITUTION_IDS } from './institutions'

export const cardSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  institution: z.enum(INSTITUTION_IDS).default('OTHER'),
  totalLimit: z.number().finite().multipleOf(0.01).positive(),
  usedLimit: z.number().finite().multipleOf(0.01).min(0).default(0),
  dueAmount: z.number().finite().multipleOf(0.01).min(0).default(0),
  expectedDue: z.number().finite().multipleOf(0.01).nonnegative().nullable().default(null),
  billDueDate: z.string().date().nullable().default(null),
  minimumDue: z.number().finite().multipleOf(0.01).min(0).default(0),
  dueDate: z.number().int().min(1).max(31),
  statementDate: z.number().int().min(1).max(31),
  color: z.string().default('#006494'),
  type: z.enum(['CARD', 'PAYLATER']).default('CARD'),
})

export function cardBalanceError(card: { usedLimit: number; dueAmount: number; minimumDue: number }) {
  if (card.minimumDue > card.dueAmount) return 'Minimum due cannot exceed the actual bill remaining'
  if (card.dueAmount > card.usedLimit) return 'Actual bill cannot exceed outstanding usage; update the used amount to include the bill'
  return null
}
