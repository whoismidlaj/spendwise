import { PrismaClient, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clear existing demo data
  const existing = await prisma.user.findUnique({ where: { email: 'demo@spendwise.app' } })
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } })
  }

  const hashedPassword = await bcrypt.hash('demo1234', 12)

  const user = await prisma.user.create({
    data: {
      email: 'demo@spendwise.app',
      name: 'Demo User',
      password: hashedPassword,
      currency: 'INR',
    },
  })

  // Accounts
  const hdfc = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'HDFC Savings',
      type: AccountType.BANK,
      balance: 85000,
      color: '#01696f',
    },
  })

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'ICICI Current',
      type: AccountType.BANK,
      balance: 42000,
      color: '#006494',
    },
  })

  const wallet = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'PhonePe Wallet',
      type: AccountType.WALLET,
      balance: 3500,
      color: '#5f259f',
    },
  })

  // Credit Cards
  await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: 'HDFC Millennia',
      bank: 'HDFC Bank',
      totalLimit: 150000,
      usedLimit: 42500,
      dueAmount: 42500,
      dueDate: 15,
      statementDate: 3,
      color: '#1a1a2e',
    },
  })

  await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: 'SBI SimplyCLICK',
      bank: 'State Bank of India',
      totalLimit: 80000,
      usedLimit: 18000,
      dueAmount: 18000,
      dueDate: 22,
      statementDate: 10,
      color: '#003087',
    },
  })

  // Loans and EMIs
  await prisma.debt.create({
    data: {
      userId: user.id,
      name: 'Home Loan EMI',
      direction: 'BORROWED',
      type: 'LOAN',
      amount: 3500000,
      remaining: 2975000,
      interestRate: 8.5,
      isRecurring: true,
      paymentAmount: 35000,
      paymentDate: 5,
      totalInstallments: 240,
      startDate: new Date('2021-01-01'),
    },
  })

  // Recurring bills
  await prisma.paymentPlan.create({
    data: {
      userId: user.id,
      accountId: wallet.id,
      name: 'Netflix',
      type: 'SUBSCRIPTION',
      amount: 649,
      dueDay: 12,
      startDate: new Date('2022-06-01'),
    },
  })

  await prisma.debt.create({
    data: {
      userId: user.id,
      name: 'Car Loan EMI',
      direction: 'BORROWED',
      type: 'LOAN',
      amount: 800000,
      remaining: 560000,
      interestRate: 9.0,
      isRecurring: true,
      paymentAmount: 16500,
      paymentDate: 10,
      totalInstallments: 60,
      startDate: new Date('2022-07-01'),
    },
  })

  console.log('✅ Seed complete! Demo user: demo@spendwise.app / demo1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
