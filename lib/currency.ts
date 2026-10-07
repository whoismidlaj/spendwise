export const SUPPORTED_CURRENCIES = [
  { value: 'INR', label: '₹ Indian Rupee', locale: 'en-IN' },
  { value: 'USD', label: '$ US Dollar', locale: 'en-US' },
  { value: 'EUR', label: '€ Euro', locale: 'de-DE' },
  { value: 'GBP', label: '£ British Pound', locale: 'en-GB' },
  { value: 'AED', label: 'د.إ UAE Dirham', locale: 'en-AE' },
  { value: 'SGD', label: 'S$ Singapore Dollar', locale: 'en-SG' },
] as const

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['value']
export const DEFAULT_CURRENCY: CurrencyCode = 'INR'

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.some(item => item.value === value)
}

// The signed-in user's currency, set once by the app shell so every formatted value agrees.
let activeCurrency: CurrencyCode = DEFAULT_CURRENCY

export function setActiveCurrency(code: unknown) {
  activeCurrency = isSupportedCurrency(code) ? code : DEFAULT_CURRENCY
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency
}

export function formatCurrency(amount: number, currency: string = activeCurrency): string {
  const locale = SUPPORTED_CURRENCIES.find(item => item.value === currency)?.locale ?? 'en-IN'
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}
