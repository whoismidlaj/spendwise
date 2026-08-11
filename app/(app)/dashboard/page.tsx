'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card, FAB, ProgressBar, Sheet, Badge } from '@/components/ui'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { TrendingUp, TrendingDown, CreditCard, Clock, Calendar, AlertCircle } from 'lucide-react'

interface Account { id: string; name: string; balance: number; type: string; color: string }
interface CCCard { id: string; name: string; bank: string; totalLimit: number; usedLimit: number; dueAmount: number; minimumDue: number; dueDate: number; statementDate: number; color: string; type: 'CARD' | 'PAYLATER' }
interface Debt {
  id: string
  name: string
  type: 'PERSONAL' | 'LOAN' | 'CREDIT_LINE' | 'PAY_LATER'
  amount: number
  remaining: number
  interestRate: number
  isRecurring: boolean
  paymentDate?: number
  paymentAmount?: number
  deadline?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  description?: string
}
interface Transaction { id: string; name: string; amount: number; type: string; date: string; category?: { name: string; icon: string; color: string }; account?: { name: string } }
interface Summary { totalIncome: number; totalExpense: number; netSavings: number }

function AnimatedAmount({ value, currency = 'INR' }: { value: number; currency?: string }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const duration = 800
    let rafId: number
    const raf = (time: number) => {
      const progress = Math.min((time - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(value * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(raf)
      }
    }
    rafId = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(rafId)
  }, [value])
  return <span className="tabular-nums">{formatCurrency(displayed, currency)}</span>
}

function daysUntilDueDate(dueDay: number): number {
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (due < now) due.setMonth(due.getMonth() + 1)
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

function getNextDueDate(dueDay: number): Date {
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (due < now) due.setMonth(due.getMonth() + 1)
  return due
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CCCard[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpense: 0, netSavings: 0 })
  const [fabOpen, setFabOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const [accs, ccs, dts, txs, sum] = await Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/credit-cards').then(r => r.json()),
      fetch('/api/debts').then(r => r.json()),
      fetch(`/api/transactions?limit=5`).then(r => r.json()),
      fetch(`/api/reports/summary?startDate=${start}&endDate=${end}`).then(r => r.json()),
    ])
    setAccounts(accs)
    setCards(ccs)
    setDebts(dts)
    setTransactions(txs.transactions || [])
    setSummary(sum)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)

  const formatDate = (d: string) => {
    const date = new Date(d)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // Construct upcoming dues timeline
  const upcomingDues: Array<{
    id: string
    name: string
    source: 'CARD' | 'PAYLATER' | 'DEBT'
    amount: number
    minimumAmount?: number
    dueDate: Date
    daysLeft: number
    typeLabel: string
  }> = []

  cards.forEach(card => {
    if (card.dueAmount > 0) {
      const dueDay = card.dueDate
      const daysLeft = daysUntilDueDate(dueDay)
      const dueDate = getNextDueDate(dueDay)
      upcomingDues.push({
        id: card.id,
        name: `${card.bank} ${card.name}`,
        source: card.type,
        amount: card.dueAmount,
        minimumAmount: card.minimumDue,
        dueDate,
        daysLeft,
        typeLabel: card.type === 'PAYLATER' ? 'Pay Later' : 'Credit Card'
      })
    }
  })

  debts.forEach(debt => {
    if (debt.remaining > 0) {
      if (debt.isRecurring && debt.paymentDate && debt.paymentAmount) {
        const dueDay = debt.paymentDate
        const daysLeft = daysUntilDueDate(dueDay)
        const dueDate = getNextDueDate(dueDay)
        upcomingDues.push({
          id: debt.id,
          name: debt.name,
          source: 'DEBT',
          amount: debt.paymentAmount,
          dueDate,
          daysLeft,
          typeLabel: debt.type === 'PAY_LATER' ? 'Pay Later Debt' : (debt.type === 'LOAN' ? 'Loan EMI' : 'Debt EMI')
        })
      } else if (debt.deadline) {
        const deadlineDate = new Date(debt.deadline)
        const now = new Date()
        const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)
        upcomingDues.push({
          id: debt.id,
          name: debt.name,
          source: 'DEBT',
          amount: debt.remaining,
          dueDate: deadlineDate,
          daysLeft,
          typeLabel: debt.type === 'PAY_LATER' ? 'Pay Later' : (debt.type === 'LOAN' ? 'Loan Payoff' : 'Debt Payoff')
        })
      }
    }
  })

  // Sort upcoming dues by daysLeft (ascending)
  upcomingDues.sort((a, b) => a.daysLeft - b.daysLeft)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Total Balance Card */}
      <Card className="p-5 bg-primary text-white border-0">
        <p className="text-sm text-white/70 mb-1">Total Balance</p>
        <h2 className="text-3xl font-bold mb-3">
          <AnimatedAmount value={totalBalance} />
        </h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-green-300" />
            <span className="text-sm text-white/80">{formatCurrency(summary.totalIncome)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={14} className="text-red-300" />
            <span className="text-sm text-white/80">{formatCurrency(summary.totalExpense)}</span>
          </div>
        </div>
      </Card>

      {/* Credit Cards & Pay Later Cards List */}
      {cards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">Cards & Pay Later</h3>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {cards.map(card => {
              const pct = (card.usedLimit / card.totalLimit) * 100
              const daysLeft = daysUntilDueDate(card.dueDate)
              return (
                <Card key={card.id} className="min-w-[240px] p-4 flex-shrink-0">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider mb-0.5">{card.bank} · {card.type === 'PAYLATER' ? 'Pay Later' : 'Card'}</p>
                      <p className="font-semibold text-sm dark:text-white truncate max-w-[150px]">{card.name}</p>
                    </div>
                    <CreditCard size={16} className="text-gray-400" />
                  </div>
                  <ProgressBar value={card.usedLimit} max={card.totalLimit} className="mb-2" />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span className="tabular-nums">{formatCurrency(card.usedLimit)}</span>
                    <span className="tabular-nums">{formatCurrency(card.totalLimit)}</span>
                  </div>
                  <div className="flex justify-between items-start border-t border-border dark:border-gray-800 pt-2 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400">Due</span>
                      <span className="text-xs font-semibold text-danger tabular-nums">{formatCurrency(card.dueAmount)}</span>
                    </div>
                    {card.minimumDue > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400">Min Due</span>
                        <span className="text-xs font-semibold text-warning tabular-nums">{formatCurrency(card.minimumDue)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 justify-center bg-surface-offset dark:bg-gray-800/50 py-1 rounded">
                    <Clock size={10} />{daysLeft}d left (due {card.dueDate}th)
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming Bills & Dues Section */}
      {upcomingDues.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">Upcoming Bills & Dues</h3>
          <Card className="divide-y divide-border dark:divide-gray-800 p-1">
            {upcomingDues.slice(0, 5).map(due => (
              <div key={due.id} className="flex items-center justify-between px-3 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                    due.daysLeft <= 3 
                      ? 'bg-danger/10 text-danger' 
                      : due.daysLeft <= 7 
                      ? 'bg-warning/10 text-warning' 
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <Calendar size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium dark:text-white truncate">{due.name}</p>
                      <Badge className="bg-surface-offset dark:bg-gray-800 text-[9px] text-gray-500 font-normal px-1 py-0">{due.typeLabel}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {due.daysLeft <= 0 ? (
                        <span className="text-danger font-semibold">Overdue!</span>
                      ) : (
                        `Due in ${due.daysLeft} days (${due.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <p className="text-sm font-bold text-danger tabular-nums">{formatCurrency(due.amount)}</p>
                  {due.minimumAmount && due.minimumAmount > 0 ? (
                    <p className="text-[10px] text-gray-400">Min: {formatCurrency(due.minimumAmount)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* This Month Summary */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">This Month</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
            <p className="text-xs text-green-700 dark:text-green-400 mb-1">Income</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
            <p className="text-xs text-red-700 dark:text-red-400 mb-1">Expenses</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-400 tabular-nums">
              {formatCurrency(summary.totalExpense)}
            </p>
          </div>
        </div>
      </Card>

      {/* Recent Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">Recent Transactions</h3>
        <Card className="divide-y divide-border dark:divide-gray-800">
          {transactions.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No transactions yet</p>
          )}
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '20' }}
              >
                {tx.category?.icon ?? '💸'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium dark:text-white truncate">{tx.name}</p>
                <p className="text-xs text-gray-400">{tx.account?.name ?? 'N/A'} · {formatDate(tx.date)}</p>
              </div>
              <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${tx.type === 'INCOME' ? 'text-success' : 'text-danger'}`}>
                {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <FAB onClick={() => setFabOpen(true)} />
      <Sheet open={fabOpen} onClose={() => setFabOpen(false)} title="Add Transaction">
        <TransactionForm onSuccess={() => { setFabOpen(false); load() }} />
      </Sheet>
    </div>
  )
}
