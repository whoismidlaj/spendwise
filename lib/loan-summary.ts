import { resolveLoanSchedule, settledInstallments } from './loan-schedule'

const cents = (value: number) => Math.round(value * 100) / 100

export type LoanSummary = {
  originalPrincipal: number
  principalOutstanding: number
  totalPaid: number
  principalPaid: number
  interestPaid: number
  futurePrincipal: number
  futureInterest: number
  futurePayable: number
  paidInstallments: number
  totalInstallments: number
  scheduleSource: 'lender' | 'generated' | 'none'
}

// One definition of the loan figures shown everywhere: principal, interest and future payable.
export function summarizeLoan(debt: any): LoanSummary {
  const schedule = resolveLoanSchedule(debt)
  const payments: any[] = debt.payments || []
  const settled = settledInstallments(schedule, payments.map(item => ({ installmentNumber: item.installmentNumber, paidDate: new Date(item.paidDate) })))
  const future = schedule.filter(item => !settled.has(item.number))
  const sum = (items: number[]) => cents(items.reduce((total, value) => total + value, 0))
  const totalPaid = sum(payments.map(item => Number(item.amount)))
  const principalPaid = sum(payments.map(item => Number(item.principalAmount ?? item.amount)))
  return {
    originalPrincipal: Number(debt.amount),
    principalOutstanding: Number(debt.remaining),
    totalPaid,
    principalPaid,
    interestPaid: cents(totalPaid - principalPaid),
    futurePrincipal: sum(future.map(item => item.principal)),
    futureInterest: sum(future.map(item => item.interest)),
    futurePayable: sum(future.map(item => item.amount)),
    paidInstallments: settled.size,
    totalInstallments: schedule.length,
    scheduleSource: schedule.length ? (schedule[0].custom ? 'lender' : 'generated') : 'none',
  }
}
