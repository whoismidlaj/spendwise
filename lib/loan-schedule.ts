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
