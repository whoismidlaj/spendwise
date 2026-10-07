export type LoanInstallment = { number: number; dueDate: Date; opening: number; emi: number; interest: number; principal: number; closing: number }

export function buildLoanSchedule(principal: number, annualRate: number, emi: number, count: number, startDate: string | Date, dueDay?: number): LoanInstallment[] {
  const schedule: LoanInstallment[] = []
  let opening = Math.max(0, principal)
  const start = new Date(startDate)
  for (let index = 0; index < count && opening > 0.005; index++) {
    const month = start.getMonth() + index
    const year = start.getFullYear() + Math.floor(month / 12)
    const normalizedMonth = month % 12
    const day = Math.min(dueDay || start.getDate(), new Date(year, normalizedMonth + 1, 0).getDate())
    const interest = Math.round(opening * (annualRate / 1200) * 100) / 100
    // Keep regular EMIs fixed, then settle any rounding remainder in the final one.
    const installment = index === count - 1
      ? Math.round((opening + interest) * 100) / 100
      : Math.min(emi, opening + interest)
    const principalPaid = Math.max(0, Math.round((installment - interest) * 100) / 100)
    const closing = Math.max(0, Math.round((opening - principalPaid) * 100) / 100)
    schedule.push({ number: index + 1, dueDate: new Date(year, normalizedMonth, day), opening, emi: installment, interest, principal: principalPaid, closing })
    opening = closing
  }
  return schedule
}

export type ResolvedInstallment = { number: number; dueDate: Date; amount: number; principal: number; interest: number; custom: boolean }

const cents = (value: number) => Math.round(value * 100) / 100
const dateOnly = (value: string | Date) => typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : value

// Lender-provided schedules win; otherwise fall back to the generated fixed-EMI schedule.
export function resolveLoanSchedule(debt: any): ResolvedInstallment[] {
  const custom = Array.isArray(debt.installmentSchedule) ? debt.installmentSchedule : []
  if (custom.length) {
    return custom.map((item: any, index: number) => {
      const amount = cents(Number(item.amount))
      const interest = cents(Number(item.interest ?? 0))
      const principal = item.principal !== undefined ? cents(Number(item.principal)) : cents(amount - interest)
      return { number: Number(item.number ?? index + 1), dueDate: dateOnly(item.dueDate), amount, principal, interest: cents(amount - principal), custom: true }
    })
  }
  if (debt.isRecurring && debt.paymentAmount && debt.startDate && debt.totalInstallments) {
    return buildLoanSchedule(Number(debt.amount), Number(debt.interestRate || 0), Number(debt.paymentAmount), Number(debt.totalInstallments), debt.startDate, debt.paymentDate || undefined)
      .map(item => ({ number: item.number, dueDate: new Date(Date.UTC(item.dueDate.getFullYear(), item.dueDate.getMonth(), item.dueDate.getDate(), 12)), amount: item.emi, principal: item.principal, interest: item.interest, custom: false }))
  }
  return []
}

// Payment that settled each installment. Legacy payments with no stored number are matched by month.
export function paymentsByInstallment<T extends { installmentNumber?: number | null; paidDate: Date }>(schedule: ResolvedInstallment[], payments: T[]): Map<number, T> {
  const matched = new Map<number, T>()
  for (const payment of payments) if (payment.installmentNumber) matched.set(payment.installmentNumber, payment)
  const ordered = payments.filter(item => !item.installmentNumber).sort((a, b) => a.paidDate.getTime() - b.paidDate.getTime())
  for (const payment of ordered) {
    const paidDate = new Date(payment.paidDate)
    const match = schedule.find(item => !matched.has(item.number) && item.dueDate.getUTCFullYear() === paidDate.getUTCFullYear() && item.dueDate.getUTCMonth() === paidDate.getUTCMonth())
    if (match) matched.set(match.number, payment)
  }
  return matched
}

export function settledInstallments(schedule: ResolvedInstallment[], payments: { installmentNumber?: number | null; paidDate: Date }[]): Set<number> {
  return new Set(paymentsByInstallment(schedule, payments).keys())
}
