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
const debtPay = require('../app/api/debts/[id]/pay/route')
const { summarizeLoan } = require('../lib/loan-summary')
const fixtures = require('./fixtures/loans.json')
const params = id => ({ params: Promise.resolve({ id }) })
const request = (body, method = 'POST') => new NextRequest('http://localhost/api/test', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

// Sanitized copies of the real Bajaj and Finnable loans; expected totals come from the lender documents.
function backupFor(loans) {
  return {
    format: 'spendwise-backup', version: '3.2', schema: 'monthly-planning', createdAt: new Date().toISOString(),
    accounts: [], creditCards: [], incomeSources: [], paymentPlans: [], paymentLedger: [],
    debts: loans.map((loan, index) => ({ ...loan, id: `fixture-loan-${index}`, isActive: true, payments: loan.payments.map((payment, n) => ({ ...payment, id: `fixture-payment-${index}-${n}`, accountId: null })) })),
  }
}

test('Bajaj and Finnable fixtures restore exactly and keep document totals', async () => {
  const user = await prisma.user.create({ data: { email: `test-fixtures-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    const restored = await restoreRoute.POST(request(backupFor(fixtures)))
    assert.equal(restored.status, 200)
    const backup = await (await backupRoute.GET()).json()
    for (const fixture of fixtures) {
      const debt = backup.debts.find(item => item.name === fixture.name)
      assert.ok(debt, fixture.name)
      const summary = summarizeLoan(debt)
      assert.equal(summary.principalOutstanding, fixture.expected.principalOutstanding)
      assert.equal(summary.totalPaid, fixture.expected.totalPaid)
      assert.equal(summary.principalPaid, fixture.expected.principalPaid)
      assert.equal(summary.futurePayable, fixture.expected.futureInstallmentTotal)
      assert.equal(summary.futureInterest, fixture.expected.futureInterest)
      assert.equal(summary.scheduleSource, 'lender')
      assert.equal(debt.installmentSchedule.length, fixture.totalInstallments)
      assert.equal(debt.payments.length, fixture.payments.length)
    }
    // A second round trip is byte-for-byte stable for the loan data.
    await restoreRoute.POST(request(backup))
    const again = await (await backupRoute.GET()).json()
    const normalize = debts => debts.map(({ createdAt, updatedAt, payments, ...rest }) => ({ ...rest, payments: payments.map(({ id, ...payment }) => ({ id, ...payment })).sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.id.localeCompare(b.id))
    assert.deepEqual(normalize(again.debts), normalize(backup.debts))
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})

test('paying the next Bajaj installment follows the lender schedule', async () => {
  const user = await prisma.user.create({ data: { email: `test-fixtures-pay-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    await restoreRoute.POST(request(backupFor(fixtures)))
    const bajaj = await prisma.debt.findFirst({ where: { userId, name: fixtures[0].name }, include: { payments: true } })
    const next = bajaj.installmentSchedule.find(item => !bajaj.payments.some(payment => payment.installmentNumber === item.number))
    const response = await debtPay.POST(request({ amount: next.amount }), params(bajaj.id))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.payment.installmentNumber, next.number)
    assert.equal(Number(body.payment.principalAmount), next.principal)
    assert.equal(Number(body.payment.interestAmount), next.interest)
    assert.equal(Number(body.updatedDebt.remaining), fixtures[0].expected.principalOutstanding - next.principal)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})
