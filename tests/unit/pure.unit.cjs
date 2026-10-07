require('ts-node').register({ project: 'tsconfig.seed.json', transpileOnly: true })
const Module = require('node:module')
const path = require('node:path')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (name, ...rest) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(__dirname, '..', '..', name.slice(2)) : name, ...rest)
}
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildLoanSchedule, resolveLoanSchedule, paymentsByInstallment } = require('../../lib/loan-schedule')
const { summarizeLoan } = require('../../lib/loan-summary')
const { formatCurrency, setActiveCurrency, SUPPORTED_CURRENCIES } = require('../../lib/currency')
const { parseSchedule } = require('../../lib/schedule-import')
const { parseBackup, BackupError } = require('../../lib/backup')
const { scheduleError } = require('../../lib/debt-schema')
const fixtures = require('../fixtures/loans.json')

test('generated schedule: fixed EMI, final instalment settles the rounding remainder', () => {
  const schedule = buildLoanSchedule(120000, 12, 10661.85, 12, '2026-10-05', 5)
  assert.equal(schedule.length, 12)
  assert.equal(schedule[0].interest, 1200)
  assert.equal(schedule[0].principal, 9461.85)
  assert.ok(schedule[11].closing <= 0.01)
  assert.equal(schedule.reduce((sum, item) => sum + item.principal, 0).toFixed(2), '120000.00')
})

test('lender schedule takes priority and keeps variable instalments', () => {
  const loan = fixtures[1]
  const schedule = resolveLoanSchedule({ ...loan, installmentSchedule: loan.installmentSchedule })
  assert.equal(schedule.length, loan.totalInstallments)
  assert.ok(schedule.every(item => item.custom))
  assert.notEqual(schedule[0].amount, schedule[1].amount, 'the first instalment differs from the regular EMI')
  assert.equal(resolveLoanSchedule({ isRecurring: false }).length, 0)
})

test('legacy payments without an instalment number are matched by month, numbered ones win', () => {
  const schedule = resolveLoanSchedule({ installmentSchedule: [{ number: 1, dueDate: '2026-01-10', amount: 10 }, { number: 2, dueDate: '2026-02-10', amount: 10 }] })
  const matched = paymentsByInstallment(schedule, [{ installmentNumber: 2, paidDate: new Date('2026-01-12T00:00:00Z') }, { installmentNumber: null, paidDate: new Date('2026-01-11T00:00:00Z') }])
  assert.deepEqual(Array.from(matched.keys()).sort(), [1, 2])
})

test('loan summary matches the lender documents for both fixtures', () => {
  for (const loan of fixtures) {
    const summary = summarizeLoan({ ...loan, payments: loan.payments })
    assert.equal(summary.principalOutstanding, loan.expected.principalOutstanding)
    assert.equal(summary.totalPaid, loan.expected.totalPaid)
    assert.equal(summary.principalPaid, loan.expected.principalPaid)
    assert.equal(summary.futurePayable, loan.expected.futureInstallmentTotal)
    assert.equal(summary.futureInterest, loan.expected.futureInterest)
    assert.equal(summary.interestPaid, Math.round((loan.expected.totalPaid - loan.expected.principalPaid) * 100) / 100)
  }
})

test('currency formatting follows the active currency for every supported code', () => {
  setActiveCurrency('INR'); assert.match(formatCurrency(1234567.5), /₹\s?12,34,567\.50/)
  setActiveCurrency('USD'); assert.match(formatCurrency(1234.5), /\$1,234\.50/)
  setActiveCurrency('EUR'); assert.match(formatCurrency(1234.5), /1\.234,50\s?€/)
  setActiveCurrency('GBP'); assert.match(formatCurrency(1234.5), /£1,234\.50/)
  setActiveCurrency('AED'); assert.match(formatCurrency(1234.5), /AED|د\.إ/)
  setActiveCurrency('SGD'); assert.match(formatCurrency(1234.5), /\$1,234\.50|SGD/)
  setActiveCurrency('NOPE'); assert.match(formatCurrency(5), /₹5\.00/, 'unknown currencies fall back to the default')
  assert.equal(SUPPORTED_CURRENCIES.length, 6)
  setActiveCurrency('INR')
})

test('pasted lender schedules accept ISO and day-first dates and skip headers', () => {
  const rows = parseSchedule('Date,EMI,Principal,Interest\n05/11/2026, 6,421.00, 3098, 3323\n2026-12-05\t6421\t3200\t3221\nnonsense')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].dueDate, '2026-11-05')
  assert.equal(rows[1].interest, '3221')
})

test('schedule validation catches unordered dates and rows that do not add up', () => {
  assert.match(scheduleError([{ dueDate: '2026-02-01', amount: 10 }, { dueDate: '2026-01-01', amount: 10 }]), /after/)
  assert.match(scheduleError([{ dueDate: '2026-01-01', amount: 10, principal: 5, interest: 4 }]), /equal/)
  assert.equal(scheduleError([{ dueDate: '2026-01-01', amount: 10, principal: 6, interest: 4 }]), null)
})

test('backup parser rejects bad shapes and future versions and converts older ones', () => {
  assert.throws(() => parseBackup(null), BackupError)
  assert.throws(() => parseBackup({ format: 'spendwise-backup', version: '4.0', accounts: [], debts: [] }), /newer version/)
  assert.throws(() => parseBackup({ format: 'spendwise-backup', version: '2.9', accounts: [], debts: [] }), /not supported/)
  const parsed = parseBackup({ format: 'spendwise-backup', version: '3.1', accounts: [], debts: [{ id: 'd', name: 'L', type: 'LOAN', amount: 100, remaining: 50, payments: [{ id: 'p', amount: 30, principalAmount: 20, paidDate: '2026-01-01' }] }] })
  assert.equal(parsed.backup.debts[0].payments[0].interestAmount, 10, 'older backups gain a derived interest portion')
  assert.ok(parsed.notes.some(note => note.includes('3.1')))
})

test('last working day skips weekends and respects short months', () => {
  const { lastWorkingDay, incomeDate, unconfirmedPayday } = require('../../lib/income')
  assert.equal(lastWorkingDay(2026, 9).getDate(), 30, 'Oct 31 2026 is a Saturday')
  assert.equal(lastWorkingDay(2026, 1).getDate(), 27, 'Feb 28 2026 is a Saturday')
  assert.equal(lastWorkingDay(2028, 1).getDate(), 29, 'Feb 29 2028 is a Tuesday')
  assert.equal(incomeDate(2026, 8, { paydayRule: 'LAST_WORKING_DAY' }).getDate(), 30)
  assert.equal(incomeDate(2026, 1, { paydayRule: 'DAY_OF_MONTH', payday: 31 }).getDate(), 28)
  const source = { paydayRule: 'DAY_OF_MONTH', payday: 1, occurrences: [] }
  assert.ok(unconfirmedPayday(source, new Date(2026, 9, 8)), 'a passed, unrecorded payday needs confirming')
  assert.equal(unconfirmedPayday({ ...source, occurrences: [{ expectedDate: new Date(2026, 9, 1, 12), status: 'RECEIVED' }] }, new Date(2026, 9, 8)), null)
  assert.equal(unconfirmedPayday({ ...source, payday: 31 }, new Date(2026, 9, 8)), null, 'a future payday is simply forecast')
})
