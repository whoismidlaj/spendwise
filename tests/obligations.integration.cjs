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
const { buildObligations, loadObligations } = require('../lib/obligations')
const planPay = require('../app/api/payment-plans/[id]/pay/route')
const cardPay = require('../app/api/credit-cards/[id]/pay/route')
const debtPay = require('../app/api/debts/[id]/pay/route')
const planRoute = require('../app/api/plan/route')
const obligationsRoute = require('../app/api/obligations/route')
const request = (body, method = 'POST') => new NextRequest('http://localhost/api/test', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
const params = id => ({ params: Promise.resolve({ id }) })
async function json(response, status = 200) {
  const body = await response.json()
  assert.equal(response.status, status, JSON.stringify(body))
  return body
}
const balance = async id => Number((await prisma.account.findUnique({ where: { id } })).balance)

// A fixed clock keeps these tests independent of the real calendar.
const NOW = new Date(2026, 9, 7, 10)
const range = { from: new Date(2026, 6, 1), to: new Date(2026, 9, 31, 23, 59, 59), now: NOW }

test('obligation builder: schedules, paid items, optional items and carry-forward', () => {
  const plan = { id: 'p1', name: 'Rent', type: 'RENT', amount: 1000, dueDay: 1, isEssential: true, isActive: true, startDate: new Date(2026, 7, 1), endDate: null, payments: [{ id: 'o1', dueDate: new Date(2026, 8, 1, 12), amount: 1000, paidAt: new Date(2026, 8, 1), accountId: 'a' }] }
  const optional = { id: 'p2', name: 'Streaming', type: 'SUBSCRIPTION', amount: 200, dueDay: 20, isEssential: false, isActive: true, startDate: new Date(2026, 9, 1), endDate: null, payments: [] }
  const loan = { id: 'd1', name: 'Loan', direction: 'BORROWED', type: 'LOAN', isActive: true, amount: 3000, remaining: 2000, isRecurring: true, interestRate: 10,
    installmentSchedule: [
      { number: 1, dueDate: '2026-09-15', amount: 1100, principal: 1000, interest: 100 },
      { number: 2, dueDate: '2026-10-15', amount: 1050, principal: 950, interest: 100 },
    ],
    payments: [{ id: 'dp1', installmentNumber: 1, amount: 1100, principalAmount: 1000, interestAmount: 100, paidDate: new Date(2026, 8, 15), accountId: 'a' }] }
  const items = buildObligations({ plans: [plan, optional], debts: [loan], cards: [], cardBills: [] }, range)
  const byKey = Object.fromEntries(items.map(item => [item.key, item]))
  assert.equal(byKey['RECURRING:p1:2026-08-01'].status, 'OVERDUE')
  assert.equal(byKey['RECURRING:p1:2026-09-01'].status, 'PAID')
  assert.equal(byKey['RECURRING:p1:2026-10-01'].status, 'OVERDUE')
  assert.equal(byKey['RECURRING:p2:2026-10-20'].reservedAmount, 0)
  assert.equal(byKey['RECURRING:p2:2026-10-20'].isRequired, false)
  assert.equal(byKey['LOAN:d1:1'].status, 'PAID')
  assert.deepEqual(byKey['LOAN:d1:1'].actions, ['unpay'])
  assert.equal(byKey['LOAN:d1:2'].status, 'UPCOMING')
  assert.equal(byKey['LOAN:d1:2'].amount, 1050)
  assert.equal(byKey['LOAN:d1:2'].principal, 950)
})

test('card obligation reserves minimum due when an actual bill exists and moves on once paid', () => {
  const card = { id: 'c1', name: 'Card', bank: 'Bank', type: 'CARD', isActive: true, usedLimit: 5000, dueAmount: 3000, minimumDue: 300, expectedDue: null, dueDate: 20, billDueDate: new Date(2026, 9, 20, 12) }
  const [due] = buildObligations({ plans: [], debts: [], cards: [card], cardBills: [] }, range)
  assert.equal(due.amount, 3000)
  assert.equal(due.reservedAmount, 300)
  assert.equal(due.reserves, 'MINIMUM')
  const paidBill = { creditCardId: 'c1', dueDate: new Date(2026, 9, 20, 12), statementAmount: 3000, paidAmount: 3000, paidAt: new Date(2026, 9, 5), payments: [{ id: 'cp', paidDate: new Date(2026, 9, 5), accountId: 'a' }] }
  const settled = buildObligations({ plans: [], debts: [], cards: [{ ...card, dueAmount: 0, minimumDue: 0, usedLimit: 2000, billDueDate: null }], cardBills: [paidBill] }, { ...range, to: new Date(2026, 10, 30) })
  assert.deepEqual(settled.map(item => [item.status, item.dueDate.getMonth()]), [['PAID', 9], ['UPCOMING', 10]])
})

test('Plan and Payments list the same unpaid obligations with the same amounts', async () => {
  const user = await prisma.user.create({ data: { email: `test-consistency-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    const now = require('../lib/clock').now()
    await prisma.account.create({ data: { userId, name: 'Bank', balance: 9000 } })
    await prisma.paymentPlan.create({ data: { userId, name: 'Rent', type: 'RENT', amount: 800, dueDay: 28, startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1) } })
    await prisma.paymentPlan.create({ data: { userId, name: 'Optional', type: 'SUBSCRIPTION', amount: 99, dueDay: 27, isEssential: false, startDate: new Date(now.getFullYear(), now.getMonth(), 1) } })
    await prisma.creditCard.create({ data: { userId, name: 'Card', bank: 'Bank', totalLimit: 9000, usedLimit: 2000, dueAmount: 1500, minimumDue: 150, dueDate: 25, statementDate: 5, billDueDate: new Date(now.getFullYear(), now.getMonth(), 25, 12) } })
    await prisma.debt.create({ data: { userId, name: 'Loan', type: 'LOAN', amount: 2000, remaining: 2000, isRecurring: true, paymentDate: 26, paymentAmount: 500, totalInstallments: 4, startDate: new Date(now.getFullYear(), now.getMonth(), 26, 12) } })
    const plan = await json(await planRoute.GET(new NextRequest('http://localhost/api/plan?period=month')))
    const checklist = await json(await obligationsRoute.GET(new NextRequest('http://localhost/api/obligations')))
    const planned = plan.items.filter(item => item.kind === 'PAYMENT').map(item => [item.id, item.amount]).sort()
    const listed = checklist.items.filter(item => item.status !== 'PAID').map(item => [item.key, item.amount]).sort()
    assert.deepEqual(planned, listed)
    assert.ok(planned.length >= 4)
    // Required items reserve cash; the optional one is shown but not reserved.
    assert.equal(plan.summary.optionalPayments, 99)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})

test('recurring and card payments can be marked paid and unpaid with exact balances', async () => {
  const user = await prisma.user.create({ data: { email: `test-obligations-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    const account = await prisma.account.create({ data: { userId, name: 'Bank', balance: 5000 } })
    const plan = await prisma.paymentPlan.create({ data: { userId, name: 'Internet', type: 'UTILITY', amount: 500, dueDay: 10, startDate: new Date(2026, 9, 1) } })
    await json(await planPay.POST(request({ dueDate: '2026-10-10', amount: 500, accountId: account.id }), params(plan.id)))
    assert.equal(await balance(account.id), 4500)
    let paid = (await loadObligations(prisma, userId, range)).find(item => item.sourceId === plan.id && item.dueDate.getMonth() === 9)
    assert.equal(paid.status, 'PAID')
    await json(await planPay.DELETE(request({ dueDate: '2026-10-10' }, 'DELETE'), params(plan.id)))
    assert.equal(await balance(account.id), 5000)
    assert.equal(await prisma.transaction.count({ where: { userId } }), 0)
    paid = (await loadObligations(prisma, userId, range)).find(item => item.sourceId === plan.id && item.dueDate.getMonth() === 9)
    assert.notEqual(paid.status, 'PAID')

    const card = await prisma.creditCard.create({ data: { userId, name: 'Card', bank: 'Bank', totalLimit: 10000, usedLimit: 4000, dueAmount: 3000, minimumDue: 300, dueDate: 20, statementDate: 5, billDueDate: new Date(2026, 9, 20, 12) } })
    const first = await json(await cardPay.POST(request({ amount: 1000, accountId: account.id, dueDate: '2026-10-20' }), params(card.id)))
    assert.equal(Number(first.usedLimit), 3000)
    assert.equal(Number(first.dueAmount), 2000)
    assert.equal(Number(first.minimumDue), 0)
    assert.equal(await balance(account.id), 4000)
    const bill = await prisma.cardBill.findFirst({ where: { creditCardId: card.id }, include: { payments: true } })
    assert.equal(Number(bill.statementAmount), 3000)
    assert.equal(Number(bill.paidAmount), 1000)
    assert.equal(bill.paidAt, null)
    const undone = await json(await cardPay.DELETE(request({ paymentId: bill.payments[0].id }, 'DELETE'), params(card.id)))
    assert.equal(Number(undone.usedLimit), 4000)
    assert.equal(Number(undone.dueAmount), 3000)
    assert.equal(Number(undone.minimumDue), 300)
    assert.equal(await balance(account.id), 5000)
    // Full payment marks the statement paid, and undo reopens it.
    await json(await cardPay.POST(request({ amount: 3000, accountId: account.id, dueDate: '2026-10-20' }), params(card.id)))
    const closed = await prisma.cardBill.findFirst({ where: { creditCardId: card.id }, include: { payments: true } })
    assert.ok(closed.paidAt)
    await json(await cardPay.DELETE(request({ dueDate: '2026-10-20' }, 'DELETE'), params(card.id)))
    assert.equal((await prisma.cardBill.findFirst({ where: { creditCardId: card.id } })).paidAt, null)
    assert.equal(await balance(account.id), 5000)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})

test('archived recurring payments leave Payments and the forecast but survive backup and restore', async () => {
  const paymentPlansRoute = require('../app/api/payment-plans/[id]/route')
  const restoreRoute = require('../app/api/restore/route')
  const backupRoute = require('../app/api/backup/route')
  const user = await prisma.user.create({ data: { email: `test-archive-${Date.now()}@example.invalid`, password: 'unused' } })
  userId = user.id
  try {
    const plan = await prisma.paymentPlan.create({ data: { userId, name: 'Old gym', type: 'SUBSCRIPTION', amount: 300, dueDay: 12, startDate: new Date(2026, 5, 1) } })
    const visible = async () => (await loadObligations(prisma, userId, range)).filter(item => item.sourceId === plan.id).length
    assert.ok(await visible() > 0)
    await json(await paymentPlansRoute.PATCH(request({ archived: true }, 'PATCH'), params(plan.id)))
    assert.equal(await visible(), 0)
    const backup = await (await backupRoute.GET()).json()
    assert.ok(backup.paymentPlans[0].archivedAt)
    await restoreRoute.POST(new NextRequest('http://localhost/api/restore', { method: 'POST', body: JSON.stringify(backup), headers: { 'Content-Type': 'application/json' } }))
    assert.ok((await prisma.paymentPlan.findFirst({ where: { userId } })).archivedAt)
    await json(await paymentPlansRoute.PATCH(request({ archived: false }, 'PATCH'), params(plan.id)))
    assert.ok(await visible() > 0)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})
