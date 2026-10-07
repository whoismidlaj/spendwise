// Runs against DATABASE_URL using temporary users, removed after the test.
require('dotenv').config()
require('ts-node').register({ project: 'tsconfig.seed.json', transpileOnly: true })
const Module = require('node:module')
const path = require('node:path')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (name, ...rest) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(__dirname, '..', name.slice(2)) : name, ...rest)
}
let userId
const originalLoad = Module._load
Module._load = function (name, ...rest) {
  if (name === 'next-auth') return { getServerSession: async () => ({ user: { id: userId } }) }
  return originalLoad.call(this, name, ...rest)
}
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { NextRequest } = require('next/server')
const { prisma } = require('../lib/prisma')
const backupRoute = require('../app/api/backup/route')
const restoreRoute = require('../app/api/restore/route')
const { loadObligations } = require('../lib/obligations')
const fixtures = require('./fixtures/loans.json')
const v30 = require('./fixtures/backup-v3.0.json')
const post = (body, query = '') => new NextRequest(`http://localhost/api/restore${query}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
const download = async () => (await backupRoute.GET()).json()
const snapshot = async () => ({
  accounts: await prisma.account.count({ where: { userId } }), debts: await prisma.debt.count({ where: { userId } }),
  plans: await prisma.paymentPlan.count({ where: { userId } }), ledger: await prisma.transaction.count({ where: { userId } }),
})
async function withUser(name, work) {
  const user = await prisma.user.create({ data: { email: `test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.invalid`, password: 'unused' } })
  userId = user.id
  try { await work(user) } finally { await prisma.user.delete({ where: { id: user.id } }) }
}
test.after(() => prisma.$disconnect())

const loanBackup = () => ({
  format: 'spendwise-backup', version: '3.2', schema: 'monthly-planning', createdAt: new Date().toISOString(),
  accounts: [], creditCards: [], incomeSources: [], paymentPlans: [], paymentLedger: [],
  debts: fixtures.map((loan, index) => ({ ...loan, id: `rt-loan-${index}`, isActive: true, payments: loan.payments.map((payment, n) => ({ ...payment, id: `rt-pay-${index}-${n}`, accountId: null })) })),
})

test('restoring a v3.0 backup keeps every record and reports counts', async () => {
  await withUser('v30', async () => {
    const preview = await restoreRoute.POST(post(v30, '?preview=1'))
    assert.equal(preview.status, 200)
    const summary = await preview.json()
    assert.equal(summary.version, '3.0')
    assert.equal(summary.counts.accounts, 4)
    assert.equal(summary.counts.creditCards, 3)
    assert.equal(summary.counts.debts, 0)
    assert.equal(summary.counts.paymentPlans, 2)
    assert.equal((await snapshot()).accounts, 0, 'preview must not change data')
    const response = await restoreRoute.POST(post(v30))
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.deepEqual(result.restored.accounts, 4)
    assert.ok(result.notes.some(note => note.includes('3.0')))
    assert.equal((await snapshot()).accounts, 4)
  })
})

test('unsupported and malformed files are rejected without touching data', async () => {
  await withUser('reject', async () => {
    await prisma.account.create({ data: { userId, name: 'Keep me', balance: 10 } })
    const before = await snapshot()
    const future = await restoreRoute.POST(post({ ...loanBackup(), version: '9.0' }))
    assert.equal(future.status, 400)
    assert.match((await future.json()).error, /newer version/)
    const truncated = await restoreRoute.POST(post('{"format":"spendwise-backup","version":"3.2","accounts":['))
    assert.equal(truncated.status, 400)
    assert.equal((await restoreRoute.POST(post('not json at all'))).status, 400)
    assert.equal((await restoreRoute.POST(post({ hello: 'world' }))).status, 400)
    const badType = await restoreRoute.POST(post({ ...loanBackup(), accounts: [{ id: 'a', name: 'x', balance: 'lots' }] }))
    assert.equal(badType.status, 400)
    // Invalid reference: a payment pointing at an account that is not in the file.
    const dangling = loanBackup()
    dangling.debts[0].payments[0].accountId = 'missing-account'
    const invalid = await restoreRoute.POST(post(dangling))
    assert.equal(invalid.status, 400)
    assert.match(JSON.stringify(await invalid.json()), /missing account/)
    // Broken invariant: principal outstanding above the original principal.
    const broken = loanBackup()
    broken.debts[0].remaining = broken.debts[0].amount + 100
    assert.equal((await restoreRoute.POST(post(broken))).status, 400)
    assert.deepEqual(await snapshot(), before)
    assert.equal((await prisma.account.findFirst({ where: { userId } })).name, 'Keep me')
  })
})

test('legacy recurring-expense backups convert and are not double-imported', async () => {
  await withUser('legacy', async () => {
    const legacy = {
      accounts: [{ id: 'a1', name: 'Bank', type: 'BANK', balance: 100 }], creditCards: [], debts: [], transactions: [],
      recurringExpenses: [
        { id: 'r1', name: 'Old EMI', type: 'EMI', emiAmount: 1000, emiDate: 5, totalEMIs: 10, paidEMIs: 2, loanAmount: 10000, startDate: '2026-01-05T00:00:00.000Z', isActive: true, accountId: 'a1', payments: [] },
        { id: 'r2', name: 'Old rent', type: 'RENT', emiAmount: 500, emiDate: 1, startDate: '2026-01-01T00:00:00.000Z', isActive: true, accountId: 'a1', payments: [{ id: 'p', amount: 500, paidDate: '2026-02-01T00:00:00.000Z' }] },
      ],
    }
    const response = await restoreRoute.POST(post(legacy))
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
    const debts = await prisma.debt.findMany({ where: { userId }, include: { payments: true } })
    assert.equal(debts.length, 1)
    assert.equal(debts[0].payments.length, 2)
    assert.equal(Number(debts[0].remaining), 8000)
    assert.equal(await prisma.paymentPlan.count({ where: { userId } }), 1)
    // A versioned backup that still carries the legacy collection ignores it.
    const mixed = { ...loanBackup(), recurringExpenses: legacy.recurringExpenses }
    const mixedResponse = await restoreRoute.POST(post(mixed))
    const body = await mixedResponse.json()
    assert.equal(mixedResponse.status, 200)
    assert.ok(body.warnings.some(warning => warning.includes('legacy')))
    assert.equal(await prisma.debt.count({ where: { userId } }), fixtures.length)
  })
})

test('a backup moves between accounts with the same totals and monthly obligations', async () => {
  let source
  let sourceBackup
  let sourceObligations
  const range = { from: new Date(2026, 6, 1), to: new Date(2027, 2, 31), now: new Date(2026, 9, 7) }
  await withUser('source', async () => {
    const account = await prisma.account.create({ data: { userId, name: 'Bank', balance: 5000 } })
    const card = await prisma.creditCard.create({ data: { userId, name: 'Card', bank: 'Bank', totalLimit: 9000, usedLimit: 3000, dueAmount: 2000, minimumDue: 200, dueDate: 20, statementDate: 5, billDueDate: new Date(2026, 9, 20, 12) } })
    const bill = await prisma.cardBill.create({ data: { creditCardId: card.id, dueDate: new Date(2026, 8, 20, 12), statementAmount: 1000, paidAmount: 1000, paidAt: new Date(2026, 8, 18) } })
    await prisma.cardPayment.create({ data: { creditCardId: card.id, cardBillId: bill.id, amount: 1000, accountId: account.id, usedDelta: 1000, dueDelta: 1000, minimumDelta: 100, expectedDelta: 0 } })
    await prisma.paymentPlan.create({ data: { userId, accountId: account.id, name: 'Rent', type: 'RENT', amount: 800, dueDay: 3, startDate: new Date(2026, 5, 1), endDate: new Date(2027, 0, 1) } })
    const restoredLoans = await restoreRoute.POST(post({ ...(await download()), debts: loanBackup().debts }))
    assert.equal(restoredLoans.status, 200, JSON.stringify(await restoredLoans.clone().json()))
    sourceBackup = await download()
    sourceObligations = (await loadObligations(prisma, userId, range)).map(item => [item.key.split(':')[0], item.name, item.dueDate.toISOString(), item.amount, item.status])
    source = userId
    await withUser('target', async () => {
      const result = await restoreRoute.POST(post(sourceBackup))
      const body = await result.json()
      assert.equal(result.status, 200, JSON.stringify(body))
      assert.ok(body.notes.some(note => note.includes('replaced')), 'conflicting ids are remapped')
      const copy = await download()
      const strip = backup => ({ accounts: backup.accounts.map(item => [item.name, item.balance]), cards: backup.creditCards.map(item => [item.name, item.usedLimit, item.dueAmount]), bills: backup.cardBills.map(item => [item.statementAmount, item.paidAmount]), debts: backup.debts.map(item => [item.name, item.remaining, item.payments.length]).sort(), plans: backup.paymentPlans.map(item => [item.name, item.amount, item.endDate]) })
      assert.deepEqual(strip(copy), strip(sourceBackup))
      assert.deepEqual(copy.cardPayments.map(item => item.accountId === copy.accounts[0].id), [true])
      const copiedObligations = (await loadObligations(prisma, userId, range)).map(item => [item.key.split(':')[0], item.name, item.dueDate.toISOString(), item.amount, item.status])
      assert.deepEqual(copiedObligations, sourceObligations)
    })
    assert.equal(await prisma.debt.count({ where: { userId: source } }), fixtures.length, 'source data untouched')
  })
})

test('a failure part-way through a restore rolls everything back', async () => {
  await withUser('rollback', async () => {
    const account = await prisma.account.create({ data: { userId, name: 'Existing', balance: 42 } })
    await prisma.debt.create({ data: { userId, name: 'Existing debt', type: 'PERSONAL', amount: 10, remaining: 10 } })
    const before = await snapshot()
    process.env.SPENDWISE_TEST_FAIL_RESTORE = 'after-debts'
    try {
      const response = await restoreRoute.POST(post(loanBackup()))
      assert.equal(response.status, 500)
      assert.match((await response.json()).error, /not changed/)
    } finally { delete process.env.SPENDWISE_TEST_FAIL_RESTORE }
    assert.deepEqual(await snapshot(), before)
    assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 42)
    assert.equal((await prisma.debt.findFirst({ where: { userId } })).name, 'Existing debt')
  })
})

// Opt-in: REAL_BACKUP=/path/to/spendwise-backup.json npm test  (the file stays outside the repo)
test('your real backup restores and its loans keep their totals', { skip: !process.env.REAL_BACKUP }, async () => {
  const real = JSON.parse(require('node:fs').readFileSync(process.env.REAL_BACKUP, 'utf8'))
  await withUser('real', async () => {
    const response = await restoreRoute.POST(post(real))
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
    const { summarizeLoan } = require('../lib/loan-summary')
    const restored = await (await backupRoute.GET()).json()
    for (const name of ['Bajaj', 'Finnable']) {
      const loan = restored.debts.find(item => item.name.includes(name))
      assert.ok(loan, `${name} loan is in the backup`)
      const summary = summarizeLoan(loan)
      assert.equal(summary.principalOutstanding, Number(loan.remaining))
      assert.ok(Math.abs(summary.futurePrincipal - summary.principalOutstanding) <= 1, `${name}: future principal matches outstanding`)
    }
  })
})
