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
const debtPay = require('../app/api/debts/[id]/pay/route')
function request(body, method = 'POST') {
  return new NextRequest('http://localhost/api/test', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}
function params(id) { return { params: Promise.resolve({ id }) } }
async function json(response, status = 200) {
  const body = await response.json()
  assert.equal(response.status, status, JSON.stringify(body))
  return body
}
const balance = async id => Number((await prisma.account.findUnique({ where: { id } })).balance)
const debtState = async id => prisma.debt.findUnique({ where: { id } })

// Lender schedule: variable first (odd-day) and final installments.
const lenderSchedule = [
  { number: 1, dueDate: '2026-01-15', amount: 1100, principal: 1000, interest: 100, opening: 3000, closing: 2000 },
  { number: 2, dueDate: '2026-02-15', amount: 1050, principal: 950, interest: 100, opening: 2000, closing: 1050 },
  { number: 3, dueDate: '2026-03-15', amount: 1160, principal: 1050, interest: 110, opening: 1050, closing: 0 },
]

test('loan and debt payments keep principal, interest, ledger and balances exact', async t => {
  const user = await prisma.user.create({ data: { email: `test-debt-pay-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    const account = await prisma.account.create({ data: { userId, name: 'Bank', balance: 10000 } })
    const loan = await prisma.debt.create({ data: {
      userId, name: 'Variable loan', type: 'LOAN', amount: 3000, remaining: 3000, interestRate: 10, isRecurring: true,
      paymentAmount: 1100, totalInstallments: 3, startDate: new Date('2026-01-15T12:00:00Z'), installmentSchedule: lenderSchedule,
    } })

    await t.test('variable installments split into principal and interest and undo restores everything', async () => {
      const first = await json(await debtPay.POST(request({ amount: 1100, accountId: account.id, paidDate: '2026-01-15' }), params(loan.id)))
      assert.equal(first.payment.installmentNumber, 1)
      assert.equal(Number(first.payment.principalAmount), 1000)
      assert.equal(Number(first.payment.interestAmount), 100)
      assert.equal(await balance(account.id), 8900)
      assert.equal(Number((await debtState(loan.id)).remaining), 2000)
      const ledger = await prisma.transaction.findUnique({ where: { id: first.payment.transactionId } })
      assert.equal(Number(ledger.amount), 1100)

      await json(await debtPay.DELETE(request({ paymentId: first.payment.id }, 'DELETE'), params(loan.id)))
      assert.equal(await balance(account.id), 10000)
      assert.equal(Number((await debtState(loan.id)).remaining), 3000)
      assert.equal(await prisma.transaction.findUnique({ where: { id: first.payment.transactionId } }), null)
    })

    await t.test('duplicate installments are rejected, including concurrent attempts', async () => {
      const responses = await Promise.all([1, 2].map(() => debtPay.POST(request({ amount: 1100, installmentNumber: 1 }), params(loan.id))))
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 400])
      await json(await debtPay.POST(request({ amount: 1100, installmentNumber: 1 }), params(loan.id)), 400)
      assert.equal(Number((await debtState(loan.id)).remaining), 2000)
    })

    await t.test('final EMI may exceed the remaining principal because it carries interest', async () => {
      await json(await debtPay.POST(request({ amount: 1050, accountId: account.id }), params(loan.id)))
      assert.equal(Number((await debtState(loan.id)).remaining), 1050)
      await json(await debtPay.POST(request({ amount: 1161 }), params(loan.id)), 400)
      const last = await json(await debtPay.POST(request({ amount: 1160, accountId: account.id }), params(loan.id)))
      assert.equal(last.payment.installmentNumber, 3)
      assert.equal(Number(last.payment.interestAmount), 110)
      const done = await debtState(loan.id)
      assert.equal(Number(done.remaining), 0)
      assert.equal(done.isActive, false)
    })

    await t.test('lent repayment credits the account and reversal debits it again', async () => {
      const lent = await prisma.debt.create({ data: { userId, name: 'Lent', direction: 'LENT', type: 'PERSONAL', amount: 500, remaining: 500 } })
      const before = await balance(account.id)
      const paid = await json(await debtPay.POST(request({ amount: 200, accountId: account.id }), params(lent.id)))
      assert.equal(await balance(account.id), before + 200)
      await json(await debtPay.DELETE(request({ paymentId: paid.payment.id }, 'DELETE'), params(lent.id)))
      assert.equal(await balance(account.id), before)
      assert.equal(Number((await debtState(lent.id)).remaining), 500)
      assert.equal(await prisma.transaction.count({ where: { userId, name: { contains: 'Repayment received' } } }), 0)
    })

    await t.test('undo removes the exact linked ledger entry, not a lookalike', async () => {
      const debt = await prisma.debt.create({ data: { userId, name: 'Twin', type: 'PERSONAL', amount: 100, remaining: 100 } })
      const first = await json(await debtPay.POST(request({ amount: 10, accountId: account.id }), params(debt.id)))
      const second = await json(await debtPay.POST(request({ amount: 10, accountId: account.id }), params(debt.id)))
      await json(await debtPay.DELETE(request({ paymentId: first.payment.id }, 'DELETE'), params(debt.id)))
      assert.equal(await prisma.transaction.findUnique({ where: { id: first.payment.transactionId } }), null)
      assert.notEqual(await prisma.transaction.findUnique({ where: { id: second.payment.transactionId } }), null)
    })
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})
