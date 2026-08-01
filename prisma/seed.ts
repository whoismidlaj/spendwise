import { PrismaClient, AccountType, TransactionType, RecurringType } from '@prisma/client'
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

  // Default categories
  const expenseCategories = [
    { name: 'Food & Dining', icon: '🍔', color: '#ef4444' },
    { name: 'Groceries', icon: '🛒', color: '#f97316' },
    { name: 'Transport', icon: '🚌', color: '#eab308' },
    { name: 'Shopping', icon: '🛍', color: '#a855f7' },
    { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
    { name: 'Utilities', icon: '⚡', color: '#06b6d4' },
    { name: 'Health', icon: '💊', color: '#10b981' },
    { name: 'Education', icon: '📚', color: '#3b82f6' },
    { name: 'Travel', icon: '✈️', color: '#8b5cf6' },
    { name: 'Other', icon: '📌', color: '#6b7280' },
  ]

  const incomeCategories = [
    { name: 'Salary', icon: '💼', color: '#22c55e' },
    { name: 'Freelance', icon: '💻', color: '#14b8a6' },
    { name: 'Investment', icon: '📈', color: '#6366f1' },
    { name: 'Gift', icon: '🎁', color: '#f43f5e' },
    { name: 'Other Income', icon: '💰', color: '#84cc16' },
  ]

  const createdExpenseCategories = await Promise.all(
    expenseCategories.map((cat) =>
      prisma.category.create({
        data: { ...cat, userId: user.id, type: TransactionType.EXPENSE, isSystem: true },
      })
    )
  )

  const createdIncomeCategories = await Promise.all(
    incomeCategories.map((cat) =>
      prisma.category.create({
        data: { ...cat, userId: user.id, type: TransactionType.INCOME, isSystem: true },
      })
    )
  )

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

  const icici = await prisma.account.create({
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

  // Recurring Expenses
  await prisma.recurringExpense.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      name: 'Home Loan EMI',
      type: RecurringType.EMI,
      loanAmount: 3500000,
      interestRate: 8.5,
      emiAmount: 35000,
      emiDate: 5,
      totalEMIs: 240,
      paidEMIs: 36,
      startDate: new Date('2021-01-01'),
    },
  })

  await prisma.recurringExpense.create({
    data: {
      userId: user.id,
      accountId: wallet.id,
      name: 'Netflix',
      type: RecurringType.SUBSCRIPTION,
      emiAmount: 649,
      emiDate: 12,
      startDate: new Date('2022-06-01'),
    },
  })

  await prisma.recurringExpense.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      name: 'Car Loan EMI',
      type: RecurringType.EMI,
      loanAmount: 800000,
      interestRate: 9.0,
      emiAmount: 16500,
      emiDate: 10,
      totalEMIs: 60,
      paidEMIs: 18,
      startDate: new Date('2022-07-01'),
    },
  })

  // Sample transactions over last 3 months
  const now = new Date()
  const salary = createdIncomeCategories[0]
  const food = createdExpenseCategories[0]
  const groceries = createdExpenseCategories[1]
  const transport = createdExpenseCategories[2]
  const shopping = createdExpenseCategories[3]
  const entertainment = createdExpenseCategories[4]
  const utilities = createdExpenseCategories[5]
  const health = createdExpenseCategories[6]

  const transactions = [
    // Current month
    { name: 'Monthly Salary', type: TransactionType.INCOME, amount: 95000, accountId: hdfc.id, categoryId: salary.id, daysAgo: 2 },
    { name: 'Swiggy Order', type: TransactionType.EXPENSE, amount: 450, accountId: wallet.id, categoryId: food.id, daysAgo: 1 },
    { name: 'Reliance Fresh', type: TransactionType.EXPENSE, amount: 2800, accountId: hdfc.id, categoryId: groceries.id, daysAgo: 3 },
    { name: 'Ola Cab', type: TransactionType.EXPENSE, amount: 220, accountId: wallet.id, categoryId: transport.id, daysAgo: 4 },
    { name: 'Amazon Shopping', type: TransactionType.EXPENSE, amount: 3499, accountId: hdfc.id, categoryId: shopping.id, daysAgo: 5 },
    { name: 'Movie Tickets', type: TransactionType.EXPENSE, amount: 800, accountId: icici.id, categoryId: entertainment.id, daysAgo: 6 },
    { name: 'Electricity Bill', type: TransactionType.EXPENSE, amount: 1850, accountId: hdfc.id, categoryId: utilities.id, daysAgo: 7 },
    // Last month
    { name: 'Monthly Salary', type: TransactionType.INCOME, amount: 95000, accountId: hdfc.id, categoryId: salary.id, daysAgo: 32 },
    { name: 'Zomato', type: TransactionType.EXPENSE, amount: 680, accountId: wallet.id, categoryId: food.id, daysAgo: 33 },
    { name: 'Big Basket', type: TransactionType.EXPENSE, amount: 3200, accountId: hdfc.id, categoryId: groceries.id, daysAgo: 35 },
    { name: 'Rapido Bike', type: TransactionType.EXPENSE, amount: 85, accountId: wallet.id, categoryId: transport.id, daysAgo: 36 },
    { name: 'Flipkart Sale', type: TransactionType.EXPENSE, amount: 5999, accountId: icici.id, categoryId: shopping.id, daysAgo: 38 },
    { name: 'Pharmacy', type: TransactionType.EXPENSE, amount: 450, accountId: hdfc.id, categoryId: health.id, daysAgo: 40 },
    { name: 'Water Bill', type: TransactionType.EXPENSE, amount: 350, accountId: hdfc.id, categoryId: utilities.id, daysAgo: 42 },
    // 2 months ago
    { name: 'Monthly Salary', type: TransactionType.INCOME, amount: 95000, accountId: hdfc.id, categoryId: salary.id, daysAgo: 62 },
    { name: 'Restaurant Dinner', type: TransactionType.EXPENSE, amount: 2100, accountId: icici.id, categoryId: food.id, daysAgo: 63 },
    { name: 'DMART', type: TransactionType.EXPENSE, amount: 4500, accountId: hdfc.id, categoryId: groceries.id, daysAgo: 65 },
    { name: 'Fuel', type: TransactionType.EXPENSE, amount: 2000, accountId: hdfc.id, categoryId: transport.id, daysAgo: 67 },
    { name: 'Myntra', type: TransactionType.EXPENSE, amount: 1800, accountId: icici.id, categoryId: shopping.id, daysAgo: 70 },
    { name: 'Gym Membership', type: TransactionType.EXPENSE, amount: 1500, accountId: hdfc.id, categoryId: health.id, daysAgo: 72 },
  ]

  for (const tx of transactions) {
    const date = new Date(now)
    date.setDate(date.getDate() - tx.daysAgo)
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: tx.accountId,
        categoryId: tx.categoryId,
        type: tx.type,
        amount: tx.amount,
        name: tx.name,
        date,
      },
    })
  }

  console.log('✅ Seed complete! Demo user: demo@spendwise.app / demo1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
