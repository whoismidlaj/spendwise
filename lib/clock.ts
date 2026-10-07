// The current time, overridable outside production so tests can pin the calendar.
export function now(): Date {
  const fixed = process.env.NODE_ENV !== 'production' ? process.env.SPENDWISE_FAKE_NOW : undefined
  const parsed = fixed ? new Date(fixed) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
}
