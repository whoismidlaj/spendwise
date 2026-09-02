import { remainingPrincipal } from './currency'

// Utility to escape CSV fields safely
function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '""'
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

export function downloadCSV(filename: string, csvContent: string) {
  // Add UTF-8 BOM so Excel opens special characters and symbols cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const DEBT_TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal Debt',
  LOAN: 'Loan',
  CREDIT_LINE: 'Credit Line',
  PAY_LATER: 'Pay Later',
}

export const RECURRING_TYPE_LABELS: Record<string, string> = {
  EMI: 'EMI',
  LOAN: 'Loan',
  SUBSCRIPTION: 'Subscription',
  UTILITY: 'Utility',
  RENT: 'Rent',
  OTHER: 'Other',
}

/**
 * Generates CSV for Debts & Liabilities
 */
export function generateDebtsCSV(debts: any[]): string {
  const headers = [
    'Debt Name',
    'Type',
    'Priority',
    'Total Amount',
    'Remaining Balance',
    'Paid Off Amount',
    'Progress %',
    'Interest Rate (%)',
    'Recurring EMI?',
    'Monthly Due Day',
    'Monthly Payment Amount',
    'Payoff Deadline',
    'Status',
    'Total Payments Count',
    'Notes / Description',
    'Created Date',
  ]

  const rows = debts.map((d) => {
    const totalAmount = Number(d.amount || 0)
    const remaining = Number(d.remaining || 0)
    const paid = Math.max(0, totalAmount - remaining)
    const progress = totalAmount > 0 ? ((paid / totalAmount) * 100).toFixed(1) : '0.0'
    const isSettled = remaining <= 0

    return [
      escapeCSV(d.name),
      escapeCSV(DEBT_TYPE_LABELS[d.type] || d.type),
      escapeCSV(d.priority || 'MEDIUM'),
      escapeCSV(totalAmount.toFixed(2)),
      escapeCSV(remaining.toFixed(2)),
      escapeCSV(paid.toFixed(2)),
      escapeCSV(`${progress}%`),
      escapeCSV(d.interestRate ? `${Number(d.interestRate)}%` : '0%'),
      escapeCSV(d.isRecurring ? 'Yes' : 'No'),
      escapeCSV(d.paymentDate ? `Day ${d.paymentDate}` : 'N/A'),
      escapeCSV(d.paymentAmount ? Number(d.paymentAmount).toFixed(2) : 'N/A'),
      escapeCSV(d.deadline ? new Date(d.deadline).toLocaleDateString('en-IN') : 'N/A'),
      escapeCSV(isSettled ? 'Settled / Closed' : 'Active'),
      escapeCSV(Array.isArray(d.payments) ? d.payments.length : 0),
      escapeCSV(d.description || ''),
      escapeCSV(d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : ''),
    ].join(',')
  })

  // Summary header
  const totalOutstanding = debts.reduce((sum, d) => sum + Number(d.remaining || 0), 0)
  const totalPrincipal = debts.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  const totalPaid = Math.max(0, totalPrincipal - totalOutstanding)

  const summaryRows = [
    `"Spendwise Debts & Liabilities Report - Exported on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}"`,
    `"Total Debts Count","${debts.length}"`,
    `"Total Original Principal","${totalPrincipal.toFixed(2)}"`,
    `"Total Outstanding Balance","${totalOutstanding.toFixed(2)}"`,
    `"Total Amount Paid Off","${totalPaid.toFixed(2)}"`,
    '',
    headers.map(h => escapeCSV(h)).join(','),
  ]

  return [...summaryRows, ...rows].join('\r\n')
}

/**
 * Generates CSV for Recurring Expenses & EMIs
 */
export function generateRecurringCSV(recurring: any[]): string {
  const headers = [
    'Name',
    'Category / Type',
    'Monthly EMI / Amount',
    'Due Day (Monthly)',
    'Paid EMIs',
    'Total EMIs',
    'Progress %',
    'Original Loan Principal',
    'Interest Rate (%)',
    'Remaining Principal (Est.)',
    'Linked Account',
    'Start Date',
    'Status',
  ]

  const rows = recurring.map((item) => {
    const remaining = item.loanAmount && item.totalEMIs
      ? remainingPrincipal(Number(item.loanAmount), Number(item.interestRate ?? 0), Number(item.totalEMIs), Number(item.paidEMIs))
      : null

    const progress = item.totalEMIs && item.totalEMIs > 0
      ? `${((Number(item.paidEMIs) / Number(item.totalEMIs)) * 100).toFixed(1)}%`
      : 'Ongoing'

    const isFinished = item.totalEMIs && Number(item.paidEMIs) >= Number(item.totalEMIs)

    return [
      escapeCSV(item.name),
      escapeCSV(RECURRING_TYPE_LABELS[item.type] || item.type),
      escapeCSV(Number(item.emiAmount || 0).toFixed(2)),
      escapeCSV(`Day ${item.emiDate}`),
      escapeCSV(item.paidEMIs ?? 0),
      escapeCSV(item.totalEMIs ? item.totalEMIs : 'Ongoing'),
      escapeCSV(progress),
      escapeCSV(item.loanAmount ? Number(item.loanAmount).toFixed(2) : 'N/A'),
      escapeCSV(item.interestRate ? `${Number(item.interestRate)}%` : 'N/A'),
      escapeCSV(remaining !== null ? Number(remaining).toFixed(2) : 'N/A'),
      escapeCSV(item.account?.name || 'None'),
      escapeCSV(item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN') : 'N/A'),
      escapeCSV(isFinished ? 'Completed' : item.isActive === false ? 'Inactive' : 'Active'),
    ].join(',')
  })

  const totalMonthlyCommitment = recurring.reduce((s, r) => s + Number(r.emiAmount || 0), 0)

  const summaryRows = [
    `"Spendwise Recurring Expenses & EMIs Report - Exported on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}"`,
    `"Total Recurring Items","${recurring.length}"`,
    `"Total Monthly Outflow Commitment","${totalMonthlyCommitment.toFixed(2)}"`,
    '',
    headers.map(h => escapeCSV(h)).join(','),
  ]

  return [...summaryRows, ...rows].join('\r\n')
}

/**
 * Generates CSV for Upcoming Dues & Schedule
 */
export function generateUpcomingDuesCSV(items: any[], summary?: any): string {
  const headers = [
    'Item Name',
    'Source Category',
    'Type Label',
    'Due Date',
    'Amount Due',
    'Status / Urgency',
    'Bank / Linked Account',
    'Minimum Amount (Cards)',
    'Total Balance Remaining',
  ]

  const rows = items.map((item) => {
    const urgency = item.isOverdue
      ? `Overdue by ${Math.abs(item.daysLeft)} days`
      : item.daysLeft === 0
      ? 'Due Today'
      : item.daysLeft === 1
      ? 'Due Tomorrow'
      : `Due in ${item.daysLeft} days`

    return [
      escapeCSV(item.name),
      escapeCSV(item.source),
      escapeCSV(item.typeLabel),
      escapeCSV(new Date(item.dueDate).toLocaleDateString('en-IN')),
      escapeCSV(Number(item.amount || 0).toFixed(2)),
      escapeCSV(urgency),
      escapeCSV(item.bank || item.accountName || 'N/A'),
      escapeCSV(item.minimumAmount ? Number(item.minimumAmount).toFixed(2) : 'N/A'),
      escapeCSV(item.remainingTotal ? Number(item.remainingTotal).toFixed(2) : 'N/A'),
    ].join(',')
  })

  const totalAmount = summary?.total ?? items.reduce((s, i) => s + Number(i.amount || 0), 0)

  const summaryRows = [
    `"Spendwise Upcoming Dues Schedule - Exported on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}"`,
    `"Total Scheduled Dues Count","${items.length}"`,
    `"Total Scheduled Amount","${Number(totalAmount).toFixed(2)}"`,
    '',
    headers.map(h => escapeCSV(h)).join(','),
  ]

  return [...summaryRows, ...rows].join('\r\n')
}

/**
 * Generates Unified Comprehensive Liabilities Report CSV
 */
export function generateAllLiabilitiesCSV(data: {
  debts: any[]
  recurring: any[]
  creditCards: any[]
}): string {
  const { debts, recurring, creditCards } = data

  const personalDebtsTotal = debts.reduce((sum, d) => sum + Number(d.remaining || 0), 0)
  const creditCardsTotal = creditCards.reduce((sum, c) => {
    const used = Number(c.usedLimit || 0)
    const due = Number(c.dueAmount || 0)
    return sum + (used > 0 ? used : due)
  }, 0)
  const loansRemainingTotal = recurring
    .filter(r => (r.type === 'EMI' || r.type === 'LOAN') && r.loanAmount && r.totalEMIs)
    .reduce((sum, r) => {
      const rem = remainingPrincipal(Number(r.loanAmount), Number(r.interestRate ?? 0), Number(r.totalEMIs), Number(r.paidEMIs))
      return sum + (rem || 0)
    }, 0)

  const totalLiabilities = personalDebtsTotal + creditCardsTotal + loansRemainingTotal
  const totalMonthlyCommitment = recurring.reduce((sum, r) => sum + Number(r.emiAmount || 0), 0) +
    debts.filter(d => d.isRecurring && d.paymentAmount).reduce((sum, d) => sum + Number(d.paymentAmount || 0), 0)

  const lines: string[] = [
    `"================================================================================"`,
    `"SPENDWISE COMPREHENSIVE FINANCIAL LIABILITIES & DEBTS STATEMENT"`,
    `"Exported Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}"`,
    `"================================================================================"`,
    '',
    `"--- EXECUTIVE SUMMARY ---"`,
    `"Metric","Amount"`,
    `"Total Outstanding Liabilities","${totalLiabilities.toFixed(2)}"`,
    `"Total Monthly Payment Commitments (EMIs + Recurring)","${totalMonthlyCommitment.toFixed(2)}"`,
    `"Personal & Loan Debts Outstanding","${personalDebtsTotal.toFixed(2)}"`,
    `"Credit Cards & Pay Later Utilized Balance","${creditCardsTotal.toFixed(2)}"`,
    `"Long-term EMI Loans Remaining Principal","${loansRemainingTotal.toFixed(2)}"`,
    '',
    `"================================================================================"`,
    `"SECTION 1: DEBTS & LIABILITIES"`,
    `"================================================================================"`,
    generateDebtsCSV(debts),
    '',
    `"================================================================================"`,
    `"SECTION 2: RECURRING EXPENSES & EMIS"`,
    `"================================================================================"`,
    generateRecurringCSV(recurring),
    '',
    `"================================================================================"`,
    `"SECTION 3: CREDIT CARDS & PAY LATER ACCOUNTS"`,
    `"================================================================================"`,
    [
      ['Card / Account Name', 'Bank', 'Type', 'Total Limit', 'Used Limit', 'Due Amount', 'Min Due', 'Due Date Day', 'Statement Date Day'].map(escapeCSV).join(','),
      ...creditCards.map(c => [
        escapeCSV(c.name),
        escapeCSV(c.bank),
        escapeCSV(c.type === 'PAYLATER' ? 'Pay Later' : 'Credit Card'),
        escapeCSV(Number(c.totalLimit || 0).toFixed(2)),
        escapeCSV(Number(c.usedLimit || 0).toFixed(2)),
        escapeCSV(Number(c.dueAmount || 0).toFixed(2)),
        escapeCSV(Number(c.minimumDue || 0).toFixed(2)),
        escapeCSV(`Day ${c.dueDate}`),
        escapeCSV(`Day ${c.statementDate}`),
      ].join(',')),
    ].join('\r\n'),
  ]

  return lines.join('\r\n')
}
