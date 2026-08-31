'use client'
import { useEffect, useState } from 'react'
import { formatCurrency, remainingPrincipal } from '@/lib/currency'
import { Card, Button, Sheet, Input, Select, FAB, Badge, ProgressBar, DatePicker } from '@/components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CheckCircle, Calendar, AlertCircle, CreditCard, RefreshCw, Landmark, Filter, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Transaction { id: string; name: string; amount: number; type: string; date: string; category?: { name: string; icon: string; color: string } }
interface RecurringExpense {
  id: string; name: string; type: string; emiAmount: number; emiDate: number
  totalEMIs?: number; paidEMIs: number; loanAmount?: number; interestRate?: number
  account?: { name: string }; isActive: boolean
}
interface Account { id: string; name: string }
interface CategorySummary { categoryId: string; name: string; color: string; icon: string; total: number }

interface UpcomingItem {
  id: string
  sourceId: string
  name: string
  source: 'CREDIT_CARD' | 'RECURRING' | 'DEBT'
  typeLabel: string
  amount: number
  dueDate: string
  dueDay: number
  daysLeft: number
  isOverdue: boolean
  color?: string
  bank?: string
  accountName?: string
  accountId?: string
  minimumAmount?: number
  remainingTotal?: number
  paidCount?: number
  totalCount?: number
}

interface UpcomingSummary {
  total: number
  creditCards: number
  recurring: number
  debts: number
  totalCount: number
  overdueCount: number
}

const TYPE_LABELS: Record<string, string> = { EMI: 'EMI', LOAN: 'Loan', SUBSCRIPTION: 'Subscription', UTILITY: 'Utility', RENT: 'Rent', OTHER: 'Other' }
const TYPE_COLORS: Record<string, string> = { EMI: '#01696f', LOAN: '#006494', SUBSCRIPTION: '#a855f7', UTILITY: '#f97316', RENT: '#eab308', OTHER: '#6b7280' }

function RecurringForm({ onSuccess }: { onSuccess: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState({ name: '', type: 'EMI', loanAmount: '', interestRate: '', emiAmount: '', emiDate: '', totalEMIs: '', startDate: new Date().toISOString().slice(0, 10), accountId: '' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => { fetch('/api/accounts').then(r => r.json()).then(setAccounts) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: form.name, type: form.type, emiAmount: parseFloat(form.emiAmount), emiDate: parseInt(form.emiDate),
      startDate: form.startDate, accountId: form.accountId || undefined,
      ...(form.loanAmount && { loanAmount: parseFloat(form.loanAmount) }),
      ...(form.interestRate && { interestRate: parseFloat(form.interestRate) }),
      ...(form.totalEMIs && { totalEMIs: parseInt(form.totalEMIs) }),
    }) })
    setLoading(false); onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Input label="Name" value={form.name} onChange={f('name')} placeholder="e.g. Home Loan EMI" required />
      <Select label="Type" value={form.type} onChange={f('type') as (e: React.ChangeEvent<HTMLSelectElement>) => void}>
        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Loan Amount" type="number" value={form.loanAmount} onChange={f('loanAmount')} placeholder="Optional" />
        <Input label="Interest Rate %" type="number" step="0.01" value={form.interestRate} onChange={f('interestRate')} placeholder="Optional" />
      </div>
      <Input label="EMI/Monthly Amount" type="number" value={form.emiAmount} onChange={f('emiAmount')} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="EMI Date (day)" type="number" min="1" max="31" value={form.emiDate} onChange={f('emiDate')} required />
        <Input label="Total EMIs" type="number" value={form.totalEMIs} onChange={f('totalEMIs')} placeholder="0 = ongoing" />
      </div>
      <DatePicker label="Start Date" name="startDate" value={form.startDate} onChange={f('startDate')} required />
      <Select label="Linked Account" value={form.accountId} onChange={f('accountId') as (e: React.ChangeEvent<HTMLSelectElement>) => void}>
        <option value="">None</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      <Button type="submit" size="lg" loading={loading}>Add Recurring Expense</Button>
    </form>
  )
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<'upcoming' | 'regular' | 'recurring'>('upcoming')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [summary, setSummary] = useState<CategorySummary[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fabOpen, setFabOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [period, setPeriod] = useState('thisMonth')

  // Upcoming Tab States
  const [upcomingTimeframe, setUpcomingTimeframe] = useState<'thisMonth' | 'next7Days' | 'next30Days' | 'nextMonth' | 'custom'>('thisMonth')
  const [customRange, setCustomRange] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  })
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([])
  const [upcomingSummary, setUpcomingSummary] = useState<UpcomingSummary>({
    total: 0,
    creditCards: 0,
    recurring: 0,
    debts: 0,
    totalCount: 0,
    overdueCount: 0,
  })
  const [upcomingFilter, setUpcomingFilter] = useState<'ALL' | 'CREDIT_CARD' | 'RECURRING' | 'DEBT'>('ALL')
  const [upcomingLoading, setUpcomingLoading] = useState(false)

  // Quick Pay Sheet State for Upcoming items
  const [payModalItem, setPayModalItem] = useState<UpcomingItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  function getPeriodDates(p: string) {
    const now = new Date()
    if (p === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (p === 'lastMonth') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
  }

  function getUpcomingDates(tf: typeof upcomingTimeframe) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    
    if (tf === 'thisMonth') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      }
    }
    if (tf === 'next7Days') {
      const end = new Date(today)
      end.setDate(end.getDate() + 7)
      end.setHours(23, 59, 59, 999)
      return { start: today, end }
    }
    if (tf === 'next30Days') {
      const end = new Date(today)
      end.setDate(end.getDate() + 30)
      end.setHours(23, 59, 59, 999)
      return { start: today, end }
    }
    if (tf === 'nextMonth') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
      }
    }
    // custom
    return {
      start: new Date(`${customRange.startDate}T00:00:00`),
      end: new Date(`${customRange.endDate}T23:59:59`),
    }
  }

  async function loadRegular() {
    const { start, end } = getPeriodDates(period)
    const [txs, sum] = await Promise.all([
      fetch(`/api/transactions?type=EXPENSE&startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=200`).then(r => r.json()),
      fetch(`/api/reports/summary?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).then(r => r.json()),
    ])
    setTransactions(txs.transactions || [])
    setSummary(sum.byCategory || [])
  }

  async function loadRecurring() {
    const r = await fetch('/api/recurring').then(r => r.json())
    setRecurring(r)
  }

  async function loadUpcoming() {
    setUpcomingLoading(true)
    try {
      const { start, end } = getUpcomingDates(upcomingTimeframe)
      const res = await fetch(`/api/expenses/upcoming?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).then(r => r.json())
      setUpcomingItems(res.items || [])
      setUpcomingSummary(res.summary || {
        total: 0,
        creditCards: 0,
        recurring: 0,
        debts: 0,
        totalCount: 0,
        overdueCount: 0,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setUpcomingLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(setAccounts)
  }, [])

  useEffect(() => { 
    if (tab === 'regular') loadRegular() 
  }, [tab, period])

  useEffect(() => { 
    if (tab === 'recurring') loadRecurring() 
  }, [tab])

  useEffect(() => {
    if (tab === 'upcoming') loadUpcoming()
  }, [tab, upcomingTimeframe, customRange.startDate, customRange.endDate])

  async function payEMI(id: string) {
    setPayingId(id)
    await fetch(`/api/recurring/${id}/pay`, { method: 'POST' })
    if (tab === 'recurring') loadRecurring()
    if (tab === 'upcoming') loadUpcoming()
    setPayingId(null)
  }

  async function handleOpenPayModal(item: UpcomingItem) {
    setPayModalItem(item)
    setPayAmount(String(item.amount))
    setPayAccountId(item.accountId || '')
  }

  async function handleExecutePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payModalItem) return
    setPayLoading(true)

    try {
      if (payModalItem.source === 'RECURRING') {
        await fetch(`/api/recurring/${payModalItem.sourceId}/pay`, { method: 'POST' })
      } else if (payModalItem.source === 'CREDIT_CARD') {
        await fetch(`/api/credit-cards/${payModalItem.sourceId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(payAmount),
            accountId: payAccountId || undefined,
          }),
        })
      } else if (payModalItem.source === 'DEBT') {
        await fetch(`/api/debts/${payModalItem.sourceId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(payAmount),
            accountId: payAccountId || undefined,
          }),
        })
      }

      setPayModalItem(null)
      loadUpcoming()
    } catch (err) {
      console.error(err)
    } finally {
      setPayLoading(false)
    }
  }

  const filteredTxs = selectedCategory
    ? transactions.filter(tx => tx.category?.name === selectedCategory)
    : transactions

  const filteredUpcomingItems = upcomingFilter === 'ALL'
    ? upcomingItems
    : upcomingItems.filter(item => item.source === upcomingFilter)

  function getNextDueDate(emiDate: number) {
    const now = new Date()
    const due = new Date(now.getFullYear(), now.getMonth(), emiDate)
    if (due < now) due.setMonth(due.getMonth() + 1)
    return due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="pb-4">
      {/* Top Nav Tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {(['upcoming', 'regular', 'recurring'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors',
              tab === t ? 'bg-primary text-white shadow-sm' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
            {t === 'upcoming' ? 'Upcoming Dues' : t === 'regular' ? 'Regular Expenses' : 'Recurring & EMIs'}
          </button>
        ))}
      </div>

      {/* UPCOMING EXPENSES TAB */}
      {tab === 'upcoming' && (
        <div className="px-4 space-y-4">
          {/* Timeframe selector */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {[
              { id: 'thisMonth', label: 'This Month' },
              { id: 'next7Days', label: 'Next 7 Days' },
              { id: 'next30Days', label: 'Next 30 Days' },
              { id: 'nextMonth', label: 'Next Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setUpcomingTimeframe(tf.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all',
                  upcomingTimeframe === tf.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {upcomingTimeframe === 'custom' && (
            <Card className="p-3 bg-surface-offset dark:bg-gray-800/40 grid grid-cols-2 gap-3 border-dashed">
              <DatePicker
                label="Start Date"
                name="customStart"
                value={customRange.startDate}
                onChange={(e) => setCustomRange(p => ({ ...p, startDate: e.target.value }))}
              />
              <DatePicker
                label="End Date"
                name="customEnd"
                value={customRange.endDate}
                onChange={(e) => setCustomRange(p => ({ ...p, endDate: e.target.value }))}
              />
            </Card>
          )}

          {/* Overview / Analytics Banner */}
          <Card className="p-4 bg-gradient-to-br from-primary to-primary-hover text-white shadow-md border-0">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-white/70 font-medium">Total Upcoming Expenses</p>
                <h3 className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(upcomingSummary.total)}
                </h3>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white backdrop-blur-sm">
                  {upcomingSummary.totalCount} {upcomingSummary.totalCount === 1 ? 'due' : 'dues'}
                </span>
                {upcomingSummary.overdueCount > 0 && (
                  <p className="text-[11px] text-red-200 font-medium mt-1 flex items-center justify-end gap-1">
                    <AlertCircle size={12} /> {upcomingSummary.overdueCount} overdue
                  </p>
                )}
              </div>
            </div>

            {/* Breakdown Mini Cards */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-center">
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-[10px] text-white/70">Cards & Bills</p>
                <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(upcomingSummary.creditCards)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-[10px] text-white/70">Recurring</p>
                <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(upcomingSummary.recurring)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-[10px] text-white/70">Debts & Loans</p>
                <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(upcomingSummary.debts)}</p>
              </div>
            </div>
          </Card>

          {/* Type Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            <button
              onClick={() => setUpcomingFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border',
                upcomingFilter === 'ALL'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              All ({upcomingItems.length})
            </button>
            <button
              onClick={() => setUpcomingFilter('CREDIT_CARD')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                upcomingFilter === 'CREDIT_CARD'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <CreditCard size={13} /> Cards ({upcomingItems.filter(i => i.source === 'CREDIT_CARD').length})
            </button>
            <button
              onClick={() => setUpcomingFilter('RECURRING')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                upcomingFilter === 'RECURRING'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <RefreshCw size={13} /> Recurring ({upcomingItems.filter(i => i.source === 'RECURRING').length})
            </button>
            <button
              onClick={() => setUpcomingFilter('DEBT')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                upcomingFilter === 'DEBT'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <Landmark size={13} /> Debts ({upcomingItems.filter(i => i.source === 'DEBT').length})
            </button>
          </div>


          {/* Dues List */}
          {upcomingLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUpcomingItems.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Calendar className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-base font-semibold dark:text-gray-300">No upcoming expenses found</p>
              <p className="text-xs mt-1">
                You're all clear for this timeframe or all upcoming bills are settled.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredUpcomingItems.map(item => {
                const dateObj = new Date(item.dueDate)
                const dateFormatted = dateObj.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                })

                return (
                  <Card key={item.id} className="p-4 space-y-3 relative overflow-hidden">
                    {/* Urgency accent strip */}
                    <div
                      className={cn(
                        'absolute top-0 left-0 bottom-0 w-1',
                        item.isOverdue
                          ? 'bg-danger'
                          : item.daysLeft <= 3
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      )}
                    />

                    <div className="flex justify-between items-start pl-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold dark:text-white text-sm">{item.name}</p>
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0.5',
                              item.source === 'CREDIT_CARD' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                              item.source === 'RECURRING' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                              item.source === 'DEBT' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {item.typeLabel}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          Due: <span className="font-medium text-gray-600 dark:text-gray-300">{dateFormatted}</span>
                          {item.accountName && <span>· From: {item.accountName}</span>}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-danger">
                          {formatCurrency(item.amount)}
                        </p>
                        {item.source === 'CREDIT_CARD' && item.remainingTotal && item.remainingTotal !== item.amount ? (
                          <p className="text-[10px] text-gray-400">Total: {formatCurrency(item.remainingTotal)}</p>
                        ) : item.minimumAmount && item.minimumAmount > 0 && item.minimumAmount !== item.amount ? (
                          <p className="text-[10px] text-gray-400">Min: {formatCurrency(item.minimumAmount)}</p>
                        ) : null}
                      </div>

                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border dark:border-gray-800 pl-1.5">
                      <div className="text-xs">
                        {item.isOverdue ? (
                          <span className="text-danger font-semibold flex items-center gap-1">
                            <AlertCircle size={13} /> Overdue by {Math.abs(item.daysLeft)} days
                          </span>
                        ) : item.daysLeft === 0 ? (
                          <span className="text-amber-500 font-semibold flex items-center gap-1">
                            <AlertCircle size={13} /> Due Today!
                          </span>
                        ) : item.daysLeft === 1 ? (
                          <span className="text-amber-500 font-medium">Due Tomorrow</span>
                        ) : (
                          <span className="text-gray-400">In {item.daysLeft} days</span>
                        )}
                        {item.paidCount !== undefined && item.totalCount && (
                          <span className="text-gray-400 ml-2">
                            ({item.paidCount}/{item.totalCount} paid)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {item.source === 'RECURRING' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => payEMI(item.sourceId)}
                            loading={payingId === item.sourceId}
                            className="gap-1 text-xs py-1 px-3 min-h-[32px]"
                          >
                            <CheckCircle size={13} /> Mark Paid
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(item)}
                            className="gap-1 text-xs py-1 px-3 min-h-[32px]"
                          >
                            Pay / Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* REGULAR EXPENSES TAB */}
      {tab === 'regular' && (
        <div className="px-4 space-y-4">
          <div className="flex gap-2">
            {['thisMonth', 'lastMonth', 'last3Months'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0',
                  period === p ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
                {p === 'thisMonth' ? 'This Month' : p === 'lastMonth' ? 'Last Month' : 'Last 3 Months'}
              </button>
            ))}
          </div>

          {summary.length > 0 && (
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={summary} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {summary.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend formatter={(v) => <span className="text-xs dark:text-gray-300">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedCategory(null)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium border', !selectedCategory ? 'bg-primary text-white border-primary' : 'border-border dark:border-gray-700 text-gray-600 dark:text-gray-300')}>
              All
            </button>
            {summary.map(cat => (
              <button key={cat.categoryId} onClick={() => setSelectedCategory(cat.name === selectedCategory ? null : cat.name)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', selectedCategory === cat.name ? 'text-white border-transparent' : 'border-border dark:border-gray-700 text-gray-600 dark:text-gray-300')}
                style={selectedCategory === cat.name ? { backgroundColor: cat.color } : {}}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <Card className="divide-y divide-border dark:divide-gray-800">
            {filteredTxs.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No expenses found</p>}
            {filteredTxs.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '20' }}>
                  {tx.category?.icon ?? '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{tx.name}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-danger">-{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* RECURRING EXPENSES TAB */}
      {tab === 'recurring' && (
        <div className="px-4 space-y-3">
          {recurring.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">No recurring expenses</p>
              <p className="text-sm">Tap + to add EMIs, subscriptions etc.</p>
            </div>
          )}
          {recurring.map(item => {
            const remaining = item.loanAmount && item.totalEMIs
              ? remainingPrincipal(item.loanAmount, item.interestRate ?? 0, item.totalEMIs, item.paidEMIs)
              : null
            return (
              <Card key={item.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold dark:text-white">{item.name}</p>
                    <Badge style={{ backgroundColor: (TYPE_COLORS[item.type] ?? '#6b7280') + '20', color: TYPE_COLORS[item.type] ?? '#6b7280' }}>
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </div>
                  <p className="text-xl font-bold tabular-nums dark:text-white">{formatCurrency(item.emiAmount)}</p>
                </div>

                {item.totalEMIs ? (
                  <>
                    <ProgressBar value={item.paidEMIs} max={item.totalEMIs} className="mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.paidEMIs} / {item.totalEMIs} EMIs paid</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mb-2">Ongoing · {item.paidEMIs} paid so far</p>
                )}

                {remaining !== null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Remaining principal: <span className="font-semibold tabular-nums">{formatCurrency(remaining)}</span>
                  </p>
                )}

                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">Next due: {getNextDueDate(item.emiDate)} · {item.account?.name}</p>
                  <Button size="sm" variant="outline" onClick={() => payEMI(item.id)}
                    loading={payingId === item.id} className="gap-1">
                    <CheckCircle size={13} />Mark Paid
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Floating Action Button for Recurring Expenses */}
      {tab === 'recurring' && <FAB onClick={() => setFabOpen(true)} />}

      {/* Add Recurring Sheet */}
      <Sheet open={fabOpen} onClose={() => setFabOpen(false)} title="Add Recurring Expense">
        <RecurringForm onSuccess={() => { setFabOpen(false); loadRecurring() }} />
      </Sheet>

      {/* Quick Pay Modal for Upcoming Items */}
      <Sheet
        open={Boolean(payModalItem)}
        onClose={() => setPayModalItem(null)}
        title={payModalItem ? `Record Payment for ${payModalItem.name}` : 'Record Payment'}
      >
        {payModalItem && (
          <form onSubmit={handleExecutePayment} className="space-y-4 pb-6">
            <div className="p-3 bg-surface-offset dark:bg-gray-800/60 rounded-xl space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">{payModalItem.typeLabel}</p>
              <p className="font-bold text-base dark:text-white">{payModalItem.name}</p>
              <p className="text-xs text-danger font-semibold">Total Due: {formatCurrency(payModalItem.amount)}</p>
            </div>

            <Input
              label="Payment Amount"
              type="number"
              step="any"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
              required
            />

            <Select
              label="Deduct From Account"
              value={payAccountId}
              onChange={(e) => setPayAccountId(e.target.value)}
            >
              <option value="">None (Paid from outside / Cash)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            <Button type="submit" size="lg" loading={payLoading}>
              Confirm & Record Payment
            </Button>
          </form>
        )}
      </Sheet>
    </div>
  )
}

