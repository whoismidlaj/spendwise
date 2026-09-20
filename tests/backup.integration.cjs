// Runs against DATABASE_URL using a temporary user, removed after the test.
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

test('current JSON backup restores all monthly-planning data', async () => {
  const user = await prisma.user.create({
    data: {
      email: `test-backup-${Date.now()}@example.invalid`,
      password: 'unused',
      currency: 'INR',
      cashBuffer: 2500,
    },
  })
  userId = user.id

  try {
    const account = await prisma.account.create({
      data: { userId, name: 'HDFC salary', institution: 'HDFC', balance: 78000 },
    })
    const card = await prisma.creditCard.create({
      data: {
        userId,
        name: 'SBI card',
        bank: 'SBI',
        institution: 'SBI_CARD',
        totalLimit: 100000,
        usedLimit: 12000,
        dueAmount: 9000,
        expectedDue: 11000,
        minimumDue: 500,
        dueDate: 18,
        statementDate: 2,
        reminderDays: 7,
      },
    })
    const debt = await prisma.debt.create({
      data: {
        userId,
        name: 'Laptop EMI',
        type: 'LOAN',
        amount: 60000,
        remaining: 50000,
        interestRate: 12,
        isRecurring: true,
        paymentDate: 7,
        paymentAmount: 5500,
        totalInstallments: 12,
        startDate: new Date('2026-06-07T12:00:00Z'),
        payments: { create: { amount: 5000, paidDate: new Date('2026-07-07T12:00:00Z'), accountId: account.id } },
      },
    })
    const income = await prisma.incomeSource.create({
      data: {
        userId,
        accountId: account.id,
        name: 'Salary',
        type: 'SALARY',
        frequency: 'MONTHLY',
        payday: 25,
        grossAmount: 75000,
        expectedInHand: 68000,
        defaultDeductions: 7000,
        occurrences: { create: { expectedDate: new Date('2026-09-25T12:00:00Z'), expectedAmount: 68000, actualAmount: 67500, receivedAt: new Date('2026-09-25T12:00:00Z'), status: 'RECEIVED' } },
      },
    })
    const bill = await prisma.paymentPlan.create({
      data: {
        userId,
        accountId: account.id,
        name: 'Home rent',
        type: 'RENT',
        amount: 18000,
        dueDay: 1,
        startDate: new Date('2026-01-01T12:00:00Z'),
        payments: { create: { dueDate: new Date('2026-09-01T12:00:00Z'), amount: 18000, paidAt: new Date('2026-09-01T12:00:00Z'), accountId: account.id } },
      },
    })
    await prisma.transaction.create({
      data: { userId, accountId: account.id, creditCardId: card.id, managedPayment: true, type: 'TRANSFER', amount: 1000, name: 'Card payment', date: new Date('2026-09-10T12:00:00Z') },
    })

    const backupResponse = await backupRoute.GET()
    assert.equal(backupResponse.status, 200)
    const backup = await backupResponse.json()
    assert.equal(backup.version, '3.0')
    assert.equal(backup.schema, 'monthly-planning')
    assert.equal(backup.categories, undefined)
    assert.equal(backup.budgets, undefined)
    assert.equal(backup.recurringExpenses, undefined)
    assert.equal(backup.transactions, undefined)
    assert.equal(backup.paymentLedger.length, 1)

    await prisma.user.update({ where: { id: userId }, data: { currency: 'USD', cashBuffer: 0 } })
    await prisma.account.update({ where: { id: account.id }, data: { balance: 1, institution: 'OTHER' } })

    const restoreRequest = new NextRequest('http://localhost/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    })
    const restoreResponse = await restoreRoute.POST(restoreRequest)
    assert.equal(restoreResponse.status, 200, JSON.stringify(await restoreResponse.clone().json()))

    const restoredUser = await prisma.user.findUnique({ where: { id: userId } })
    const restoredAccount = await prisma.account.findUnique({ where: { id: account.id } })
    const restoredCard = await prisma.creditCard.findUnique({ where: { id: card.id } })
    const restoredDebt = await prisma.debt.findUnique({ where: { id: debt.id }, include: { payments: true } })
    const restoredIncome = await prisma.incomeSource.findUnique({ where: { id: income.id }, include: { occurrences: true } })
    const restoredBill = await prisma.paymentPlan.findUnique({ where: { id: bill.id }, include: { payments: true } })
    const restoredLedger = await prisma.transaction.findMany({ where: { userId } })

    assert.equal(restoredUser.currency, 'INR')
    assert.equal(Number(restoredUser.cashBuffer), 2500)
    assert.equal(Number(restoredAccount.balance), 78000)
    assert.equal(restoredAccount.institution, 'HDFC')
    assert.equal(restoredCard.institution, 'SBI_CARD')
    assert.equal(Number(restoredCard.expectedDue), 11000)
    assert.equal(restoredCard.reminderDays, 7)
    assert.equal(restoredDebt.totalInstallments, 12)
    assert.equal(restoredDebt.payments.length, 1)
    assert.equal(restoredDebt.payments[0].id, backup.debts.find(item => item.id === debt.id).payments[0].id)
    assert.equal(Number(restoredIncome.expectedInHand), 68000)
    assert.equal(restoredIncome.occurrences[0].status, 'RECEIVED')
    assert.equal(restoredIncome.occurrences[0].id, backup.incomeSources.find(item => item.id === income.id).occurrences[0].id)
    assert.equal(restoredBill.type, 'RENT')
    assert.equal(restoredBill.payments.length, 1)
    assert.equal(restoredBill.payments[0].id, backup.paymentPlans.find(item => item.id === bill.id).payments[0].id)
    assert.equal(restoredLedger.length, 1)
    assert.equal(restoredLedger[0].managedPayment, true)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
})
