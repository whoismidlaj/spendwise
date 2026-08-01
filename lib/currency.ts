export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function remainingPrincipal(
  loanAmount: number,
  annualRate: number,
  totalEMIs: number,
  paidEMIs: number
): number {
  if (annualRate === 0) return loanAmount * (1 - paidEMIs / totalEMIs)
  const r = annualRate / 12 / 100
  return (
    (loanAmount * (Math.pow(1 + r, totalEMIs) - Math.pow(1 + r, paidEMIs))) /
    (Math.pow(1 + r, totalEMIs) - 1)
  )
}
