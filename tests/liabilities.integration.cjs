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
const cards = require('../app/api/credit-cards/route')
const cardDetail = require('../app/api/credit-cards/[id]/route')
const cardPay = require('../app/api/credit-cards/[id]/pay/route')
const debts = require('../app/api/debts/route')
const debtPay = require('../app/api/debts/[id]/pay/route')
const transactions = require('../app/api/transactions/route')
const transactionDetail = require('../app/api/transactions/[id]/route')
const upcoming = require('../app/api/expenses/upcoming/route')
const incomeSources = require('../app/api/income-sources/route')
const receiveIncome = require('../app/api/income-sources/[id]/receive/route')
const paymentPlans = require('../app/api/payment-plans/route')
const payPaymentPlan = require('../app/api/payment-plans/[id]/pay/route')
const plan = require('../app/api/plan/route')
function request(body, method = 'POST') {
  return new NextRequest('http://localhost/api/test', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}
function params(id) { return { params: Promise.resolve({ id }) } }
async function json(response, status = 200) {
  const body = await response.json()
  assert.equal(response.status, status, JSON.stringify(body))
  return body
}

test('variable bills, usage, repayments and lending remain consistent', async t => {
  const user = await prisma.user.create({ data: { email: `test-liabilities-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  let otherUser
  try {
    const account = await prisma.account.create({ data: { userId, name: 'Test bank', balance: 1000 } })
    otherUser = await prisma.user.create({ data: { email: `test-other-${Date.now()}@example.invalid`, password: 'unused' } })
    const foreignAccount = await prisma.account.create({ data: { userId: otherUser.id, name: 'Other bank' } })
    let card, purchase, lent
    await t.test('pay later accepts a usage estimate and separate bill/minimum', async () => {
      card = await json(await cards.POST(request({ name: 'Pay Later', bank: 'Provider', type: 'PAYLATER', totalLimit: 5000, usedLimit: 500, dueAmount: 200, minimumDue: 50, dueDate: 20, statementDate: 5, billDueDate: '2026-09-20' })), 201)
      assert.equal(card.expectedDue, null)
      purchase = await json(await transactions.POST(request({ type: 'EXPENSE', amount: 100, name: 'Purchase', date: '2026-09-01', creditCardId: card.id })), 201)
      const updated = await prisma.creditCard.findUnique({ where: { id: card.id } })
      assert.equal(Number(updated.usedLimit), 600)
      assert.equal(Number(updated.dueAmount), 200)
      assert.equal(Number(updated.minimumDue), 50)
    })
    await t.test('edits and deletions change usage without changing a statement', async () => {
      await json(await transactionDetail.PATCH(request({ amount: 150 }, 'PATCH'), params(purchase.id)))
      let updated = await prisma.creditCard.findUnique({ where: { id: card.id } })
      assert.equal(Number(updated.usedLimit), 650)
      assert.equal(Number(updated.dueAmount), 200)
      await json(await transactionDetail.DELETE(new NextRequest('http://localhost/api/test', { method: 'DELETE' }), params(purchase.id)))
      updated = await prisma.creditCard.findUnique({ where: { id: card.id } })
      assert.equal(Number(updated.usedLimit), 500)
    })
    await t.test('manual estimate, minimum and usage are reduced by a payment', async () => {
      await json(await cardDetail.PATCH(request({ expectedDue: 400 }, 'PATCH'), params(card.id)))
      const paid = await json(await cardPay.POST(request({ amount: 50, accountId: account.id }), params(card.id)))
      assert.equal(paid.usedLimit, 450)
      assert.equal(paid.expectedDue, 350)
      assert.equal(paid.dueAmount, 150)
      assert.equal(paid.minimumDue, 0)
      assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 950)
      const entry = await prisma.transaction.findFirst({ where: { userId, managedPayment: true } })
      assert.equal(entry.type, 'TRANSFER')
      await json(await transactionDetail.PATCH(request({ amount: 99 }, 'PATCH'), params(entry.id)), 400)
      await json(await cardDetail.PATCH(request({ expectedDue: null }, 'PATCH'), params(card.id)))
    })
    await t.test('rejects overpayments and another user account without partial writes', async () => {
      await json(await cardPay.POST(request({ amount: 1000, accountId: account.id }), params(card.id)), 400)
      await json(await cardPay.POST(request({ amount: 25, accountId: foreignAccount.id }), params(card.id)), 404)
      await json(await transactions.POST(request({ type: 'EXPENSE', amount: 10, name: 'Invalid', date: '2026-09-01', accountId: foreignAccount.id })), 400)
      assert.equal(Number((await prisma.creditCard.findUnique({ where: { id: card.id } })).usedLimit), 450)
    })
    await t.test('received repayment credits the bank and retains settled history and date', async () => {
      lent = await json(await debts.POST(request({ name: 'Loan to friend', direction: 'LENT', type: 'PERSONAL', amount: 300, deadline: '2026-09-20' })), 201)
      const paid = await json(await debtPay.POST(request({ amount: 100, accountId: account.id, paidDate: '2026-09-10' }), params(lent.id)))
      assert.equal(paid.updatedDebt.remaining, 200)
      assert.equal(paid.payment.paidDate.slice(0, 10), '2026-09-10')
      assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 1050)
      await json(await debtPay.POST(request({ amount: 201 }), params(lent.id)), 400)
      await json(await debtPay.POST(request({ amount: 200 }), params(lent.id)))
      const list = await json(await debts.GET())
      const settled = list.find(d => d.id === lent.id)
      assert.equal(settled.isActive, false)
      assert.equal(settled.payments.length, 2)
    })
    await t.test('borrowed repayments debit the account', async () => {
      const borrowed = await json(await debts.POST(request({ name: 'Borrowed', type: 'PERSONAL', amount: 50 })), 201)
      assert.equal(borrowed.direction, 'BORROWED')
      await json(await debtPay.POST(request({ amount: 50, accountId: account.id }), params(borrowed.id)))
      assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 1000)
    })
    await t.test('concurrent repayments cannot exceed the balance', async () => {
      const debt = await prisma.debt.create({ data: { userId, name: 'Concurrent', type: 'PERSONAL', amount: 100, remaining: 100 } })
      const responses = await Promise.all([debtPay.POST(request({ amount: 75 }), params(debt.id)), debtPay.POST(request({ amount: 75 }), params(debt.id))])
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 400])
      assert.equal(Number((await prisma.debt.findUnique({ where: { id: debt.id } })).remaining), 25)
    })
    await t.test('rejects inconsistent bill fields and ignores ownership fields', async () => {
      await json(await cardDetail.PATCH(request({ minimumDue: 999 }, 'PATCH'), params(card.id)), 400)
      await json(await cardDetail.PATCH(request({ expectedDue: -1 }, 'PATCH'), params(card.id)), 400)
      await json(await cardDetail.PATCH(request({ userId: otherUser.id, expectedDue: 0 }, 'PATCH'), params(card.id)))
      const current = await prisma.creditCard.findUnique({ where: { id: card.id } })
      assert.equal(current.userId, userId)
      assert.equal(Number(current.expectedDue), 0)
    })
    await t.test('dated card bill appears once and lent balances are excluded from outgoing dues', async () => {
      await prisma.debt.create({ data: { userId, name: 'Receivable', direction: 'LENT', type: 'PERSONAL', amount: 1000, remaining: 1000, deadline: new Date('2026-09-20') } })
      await prisma.debt.create({ data: { userId, name: 'Dated payable', type: 'PERSONAL', amount: 75, remaining: 75, deadline: new Date('2026-09-20') } })
      const result = await json(await upcoming.GET(new NextRequest('http://localhost/api/expenses/upcoming?startDate=2026-09-01&endDate=2026-12-31')))
      assert.equal(result.items.filter(item => item.source === 'CREDIT_CARD').length, 1)
      assert.equal(result.items.find(item => item.source === 'CREDIT_CARD').amount, 150)
      assert.equal(result.items.filter(item => item.name === 'Receivable').length, 0)
      assert.equal(result.items.find(item => item.name === 'Dated payable').amount, 75)
    })
    await t.test('salary, safety buffer, planned bills and their actual records drive the payment plan', async () => {
      await prisma.user.update({ where: { id: userId }, data: { cashBuffer: 200 } })
      const salary = await json(await incomeSources.POST(request({ name: 'Take-home salary', type: 'SALARY', payday: 25, grossAmount: 65000, defaultDeductions: 5000, expectedInHand: 60000, accountId: account.id })), 201)
      const bill = await json(await paymentPlans.POST(request({ name: 'Electricity', type: 'UTILITY', amount: 1000, dueDay: 22, isEssential: true, accountId: account.id })), 201)
      const before = await json(await plan.GET(new NextRequest('http://localhost/api/plan?days=30')))
      assert.ok(before.summary.expectedIncome >= 60000)
      assert.ok(before.summary.requiredPayments >= 1000)
      await json(await receiveIncome.POST(request({ expectedDate: '2026-09-25', amount: 59500, accountId: account.id }), params(salary.id)))
      assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 60500)
      await json(await payPaymentPlan.POST(request({ dueDate: '2026-09-22', amount: 1000, accountId: account.id }), params(bill.id)))
      assert.equal(Number((await prisma.account.findUnique({ where: { id: account.id } })).balance), 59500)
      const after = await json(await plan.GET(new NextRequest('http://localhost/api/plan?days=30')))
      assert.equal(after.summary.receivedIncome, 59500)
      assert.equal(after.items.some(item => item.name === 'Electricity'), false)
      await json(await payPaymentPlan.POST(request({ dueDate: '2026-09-22', amount: 1000, accountId: account.id }), params(bill.id)), 400)
    })
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    if (otherUser) await prisma.user.delete({ where: { id: otherUser.id } })
    await prisma.$disconnect()
  }
})
