import { z } from 'zod'

const money = () => z.number().finite().multipleOf(0.01)

export const installmentSchema = z.object({
  number: z.number().int().positive().optional(),
  dueDate: z.string().date(),
  amount: money().nonnegative(),
  principal: money().nonnegative().optional(),
  interest: money().nonnegative().optional(),
  opening: money().nonnegative().optional(),
  closing: money().nonnegative().optional(),
})

export const debtFields = {
  name: z.string().trim().min(1),
  direction: z.enum(['BORROWED', 'LENT']),
  // PAY_LATER accounts are managed under Cards; the enum value stays only for existing records.
  type: z.enum(['PERSONAL', 'LOAN', 'CREDIT_LINE', 'PAY_LATER']),
  amount: money().positive(),
  interestRate: money().nonnegative(),
  isRecurring: z.boolean(),
  paymentDate: z.number().int().min(1).max(31).nullable(),
  paymentAmount: money().positive().nullable(),
  totalInstallments: z.number().int().positive().nullable(),
  startDate: z.string().date().nullable(),
  totalRepaymentAmount: money().positive().nullable(),
  totalInterestAmount: money().nonnegative().nullable(),
  installmentSchedule: z.array(installmentSchema).min(1).nullable(),
  deadline: z.string().date().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().nullable(),
}

// A lender schedule must be ordered, numbered consecutively and add up row by row.
export function scheduleError(schedule: z.infer<typeof installmentSchema>[] | null | undefined): string | null {
  if (!schedule) return null
  for (let index = 0; index < schedule.length; index++) {
    const item = schedule[index]
    if (item.number !== undefined && item.number !== index + 1) return `Installment numbers must run 1 to ${schedule.length} in order`
    if (index > 0 && item.dueDate <= schedule[index - 1].dueDate) return `Installment ${index + 1} must be due after installment ${index}`
    if (item.principal !== undefined && item.interest !== undefined && Math.abs(item.principal + item.interest - item.amount) > 0.015) {
      return `Installment ${index + 1}: principal plus interest must equal the amount`
    }
  }
  return null
}

// Fill in numbers so every stored installment is addressable by a stable number.
export function normalizeSchedule(schedule: z.infer<typeof installmentSchema>[]) {
  return schedule.map((item, index) => ({ ...item, number: index + 1 }))
}
