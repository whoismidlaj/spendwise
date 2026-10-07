import { monthDate } from './planning'

export type PaydayRule = 'DAY_OF_MONTH' | 'LAST_WORKING_DAY'

// Last Monday-Friday of a month. Public holidays are not known, so an early payment is recorded manually.
export function lastWorkingDay(year: number, month: number): Date {
  const date = new Date(year, month + 1, 0, 12)
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1)
  return date
}

export function incomeDate(year: number, month: number, source: { paydayRule?: string | null; payday?: number | null }): Date | null {
  if (source.paydayRule === 'LAST_WORKING_DAY') return lastWorkingDay(year, month)
  return source.payday ? monthDate(year, month, source.payday) : null
}

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// A payday that has passed with nothing recorded: the money may already be in the bank balance,
// so it must not be forecast as still to come. The user confirms it instead.
export function unconfirmedPayday(source: { paydayRule?: string | null; payday?: number | null; occurrences: { expectedDate: Date | string; status: string }[] }, now: Date): Date | null {
  const date = incomeDate(now.getFullYear(), now.getMonth(), source)
  if (!date || key(date) >= key(now)) return null
  const done = source.occurrences.some(item => key(new Date(item.expectedDate)) === key(date) && (item.status === 'RECEIVED' || item.status === 'SKIPPED'))
  return done ? null : date
}
