'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, remainingPrincipal } from '@/lib/currency'
import { Card, FAB, Sheet, Badge, Button, Input, Select, DatePicker, ProgressBar } from '@/components/ui'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { Trash2, Edit2, Search, CheckCircle, RefreshCw, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string; name: string; amount: number; type: string; date: string
  category?: { name: string; icon: string; color: string }
  account?: { name: string }
  creditCard?: { name: string }
}

interface RecurringExpense {
  id: string; name: string; type: string; emiAmount: number; emiDate: number
  totalEMIs?: number; paidEMIs: number; loanAmount?: number; interestRate?: number
  startDate: string; account?: { name: string }; accountId?: string; isActive: boolean
}

interface Account { id: string; name: string }
interface CreditCard { id: string; name: string }

const TYPE_LABELS: Record<string, string> = {
  EMI: 'EMI',
  LOAN: 'Loan',
  SUBSCRIPTION: 'Subscription',
  UTILITY: 'Utility',
  RENT: 'Rent',
  OTHER: 'Other',
}

const TYPE_COLORS: Record<string, string> = {
  EMI: '#01696f',
  LOAN: '#006494',
  SUBSCRIPTION: '#a855f7',
  UTILITY: '#f97316',
  RENT: '#eab308',
  OTHER: '#6b7280',
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  date.setHours(0, 0, 0, 0)
  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function groupByDate(txs: Transaction[]): Record<string, Transaction[]> {
  return txs.reduce((acc, tx) => {
    const label = getDateLabel(tx.date)
    if (!acc[label]) acc[label] = []
    acc[label].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)
}

export default function TransactionsPage() {
  const [mainTab, setMainTab] = useState<'regular' | 'recurring'>('regular')

  // Regular Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [total, setTotal] = useState(0)
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    accountId: '', type: 'ALL', period: 'thisMonth', search: '',
  })

  // Recurring Commitments State
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [addRecurringOpen, setAddRecurringOpen] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  // Recurring Form State (Add / Edit)
  const [recForm, setRecForm] = useState({
    name: '',
    type: 'EMI',
    loanAmount: '',
    interestRate: '',
    emiAmount: '',
    emiDate: '',
    totalEMIs: '',
    startDate: new Date().toISOString().slice(0, 10),
    accountId: '',
  })
  const [recFormLoading, setRecFormLoading] = useState(false)

  function getPeriodDates(period: string) {
    const now = new Date()
    if (period === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (period === 'lastMonth') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }
    if (period === 'last3Months') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    return { start: new Date(2000, 0, 1), end: new Date() }
  }

  const loadRegular = useCallback(async () => {
    setLoading(true)
    const { start, end } = getPeriodDates(filters.period)
    const params = new URLSearchParams({
      startDate: start.toISOString(), endDate: end.toISOString(), limit: '100',
      ...(filters.accountId && { accountId: filters.accountId }),
      ...(filters.type !== 'ALL' && { type: filters.type }),
      ...(filters.search && { search: filters.search }),
    })
    const res = await fetch(`/api/transactions?${params}`)
    const data = await res.json()
    setTransactions(data.transactions || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [filters])

  const loadRecurring = useCallback(async () => {
    setRecurringLoading(true)
    try {
      const res = await fetch('/api/recurring').then(r => r.json())
      setRecurring(res || [])
    } finally {
      setRecurringLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetch('/api/accounts').then(r => r.json()), fetch('/api/credit-cards').then(r => r.json())])
      .then(([a, c]) => { setAccounts(a || []); setCards(c || []) })
  }, [])

  useEffect(() => {
    if (mainTab === 'regular') loadRegular()
    if (mainTab === 'recurring') loadRecurring()
  }, [mainTab, loadRegular, loadRecurring])

  async function deleteTx(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    loadRegular()
  }

  async function payEMI(id: string) {
    setPayingId(id)
    await fetch(`/api/recurring/${id}/pay`, { method: 'POST' })
    loadRecurring()
    setPayingId(null)
  }

  async function deleteRecurring(id: string) {
    if (!confirm('Are you sure you want to delete this recurring commitment?')) return
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    loadRecurring()
  }

  function openAddRecurring() {
    setEditingRecurring(null)
    setRecForm({
      name: '',
      type: 'EMI',
      loanAmount: '',
      interestRate: '',
      emiAmount: '',
      emiDate: '',
      totalEMIs: '',
      startDate: new Date().toISOString().slice(0, 10),
      accountId: '',
    })
    setAddRecurringOpen(true)
  }

  function openEditRecurring(item: RecurringExpense) {
    setEditingRecurring(item)
    setRecForm({
      name: item.name,
      type: item.type,
      loanAmount: item.loanAmount ? String(item.loanAmount) : '',
      interestRate: item.interestRate ? String(item.interestRate) : '',
      emiAmount: String(item.emiAmount),
      emiDate: String(item.emiDate),
      totalEMIs: item.totalEMIs ? String(item.totalEMIs) : '',
      startDate: item.startDate ? item.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      accountId: item.accountId || '',
    })
    setAddRecurringOpen(true)
  }

  async function handleSaveRecurring(e: React.FormEvent) {
    e.preventDefault()
    setRecFormLoading(true)

    const payload = {
      name: recForm.name,
      type: recForm.type,
      emiAmount: parseFloat(recForm.emiAmount),
      emiDate: parseInt(recForm.emiDate, 10),
      startDate: recForm.startDate,
      accountId: recForm.accountId || null,
      loanAmount: recForm.loanAmount ? parseFloat(recForm.loanAmount) : null,
      interestRate: recForm.interestRate ? parseFloat(recForm.interestRate) : null,
      totalEMIs: recForm.totalEMIs ? parseInt(recForm.totalEMIs, 10) : null,
    }

    try {
      if (editingRecurring) {
        await fetch(`/api/recurring/${editingRecurring.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      setAddRecurringOpen(false)
      setEditingRecurring(null)
      loadRecurring()
    } catch (err) {
      console.error(err)
    } finally {
      setRecFormLoading(false)
    }
  }

  function getNextDueDate(emiDate: number) {
    const now = new Date()
    const due = new Date(now.getFullYear(), now.getMonth(), emiDate)
    if (due < now) due.setMonth(due.getMonth() + 1)
    return due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const grouped = groupByDate(transactions)

  return (
    <div className="pb-4">
      {/* Top Main Tabs */}
      <div className="flex gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-border dark:border-gray-800">
        <button
          onClick={() => setMainTab('regular')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all',
            mainTab === 'regular'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          )}
        >
          Regular Transactions
        </button>
        <button
          onClick={() => setMainTab('recurring')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all',
            mainTab === 'recurring'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          )}
        >
          Recurring & EMIs
        </button>
      </div>

      {/* REGULAR TRANSACTIONS */}
      {mainTab === 'regular' && (
        <>
          {/* Filters */}
          <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-border dark:border-gray-800 space-y-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {['thisMonth', 'lastMonth', 'last3Months', 'all'].map(p => (
                <button key={p} onClick={() => setFilters(f => ({ ...f, period: p }))}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors',
                    filters.period === p ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
                  {p === 'thisMonth' ? 'This Month' : p === 'lastMonth' ? 'Last Month' : p === 'last3Months' ? 'Last 3 Months' : 'All Time'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <select
                value={filters.type}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                className="px-3 py-2 text-sm rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
          </div>

          {/* Transaction List */}
          <div className="px-4 mt-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-1">No transactions found</p>
                <p className="text-sm">Tap + to add your first transaction</p>
              </div>
            ) : (
              Object.entries(grouped).map(([label, txs]) => (
                <div key={label} className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">{label}</p>
                  <Card className="divide-y divide-border dark:divide-gray-800">
                    {txs.map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 group">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '20' }}>
                          {tx.category?.icon ?? '💸'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium dark:text-white truncate">{tx.name}</p>
                          <p className="text-xs text-gray-400">
                            {tx.account?.name ?? tx.creditCard?.name ?? 'N/A'}
                            {' · '}{new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', tx.type === 'INCOME' ? 'text-success' : 'text-danger')}>
                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 md:flex transition-opacity">
                          <button onClick={() => setEditTx(tx)} className="p-1.5 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg" title="Edit">
                            <Edit2 size={13} className="text-gray-400" />
                          </button>
                          <button onClick={() => deleteTx(tx.id)} className="p-1.5 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg" title="Delete">
                            <Trash2 size={13} className="text-danger" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              ))
            )}
          </div>

          <FAB onClick={() => setAddTxOpen(true)} />
        </>
      )}

      {/* RECURRING COMMITMENTS */}
      {mainTab === 'recurring' && (
        <div className="px-4 space-y-3 mt-3">
          {recurringLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recurring.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <RefreshCw className="mx-auto h-12 w-12 text-gray-500 mb-2 opacity-50" />
              <p className="text-lg mb-1">No recurring commitments</p>
              <p className="text-sm">Tap + to add recurring EMIs, subscriptions, rent, etc.</p>
            </div>
          ) : (
            recurring.map(item => {
              const remaining = item.loanAmount && item.totalEMIs
                ? remainingPrincipal(item.loanAmount, item.interestRate ?? 0, item.totalEMIs, item.paidEMIs)
                : null

              return (
                <Card key={item.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold dark:text-white text-base">{item.name}</p>
                      <Badge style={{ backgroundColor: (TYPE_COLORS[item.type] ?? '#6b7280') + '20', color: TYPE_COLORS[item.type] ?? '#6b7280' }}>
                        {TYPE_LABELS[item.type] || item.type}
                      </Badge>
                    </div>
                    <p className="text-xl font-bold tabular-nums dark:text-white">{formatCurrency(item.emiAmount)}</p>
                  </div>

                  {item.totalEMIs ? (
                    <div>
                      <ProgressBar value={item.paidEMIs} max={item.totalEMIs} className="mb-1.5" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.paidEMIs} / {item.totalEMIs} EMIs paid</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Ongoing commitment · {item.paidEMIs} payments made</p>
                  )}

                  {remaining !== null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Remaining principal: <span className="font-semibold tabular-nums">{formatCurrency(remaining)}</span>
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-border dark:border-gray-800">
                    <p className="text-xs text-gray-400">
                      Next due: {getNextDueDate(item.emiDate)} {item.account?.name ? `· ${item.account.name}` : ''}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditRecurring(item)}
                        className="text-gray-600 dark:text-gray-300 px-2 py-1 min-h-[32px]"
                        title="Edit Recurring"
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteRecurring(item.id)}
                        className="text-danger border-danger/30 hover:bg-danger/10 px-2 py-1 min-h-[32px]"
                        title="Delete Recurring"
                      >
                        <Trash2 size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => payEMI(item.id)}
                        loading={payingId === item.id}
                        className="gap-1 text-xs px-3 py-1 min-h-[32px]"
                      >
                        <CheckCircle size={13} /> Mark Paid
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })
          )}

          <FAB onClick={openAddRecurring} />
        </div>
      )}

      {/* Add Transaction Sheet */}
      <Sheet open={addTxOpen} onClose={() => setAddTxOpen(false)} title="Add Transaction">
        <TransactionForm onSuccess={() => { setAddTxOpen(false); loadRegular() }} />
      </Sheet>

      {/* Edit Transaction Sheet */}
      <Sheet open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        {editTx && (
          <TransactionForm
            onSuccess={() => { setEditTx(null); loadRegular() }}
            initial={{
              id: editTx.id,
              type: editTx.type as 'EXPENSE' | 'INCOME',
              amount: String(editTx.amount),
              name: editTx.name,
              date: editTx.date,
            }}
          />
        )}
      </Sheet>

      {/* Add / Edit Recurring Sheet */}
      <Sheet
        open={addRecurringOpen}
        onClose={() => { setAddRecurringOpen(false); setEditingRecurring(null) }}
        title={editingRecurring ? `Edit ${editingRecurring.name}` : 'Add Recurring Commitment'}
      >
        <form onSubmit={handleSaveRecurring} className="space-y-4 pb-6">
          <Input
            label="Name / Title"
            value={recForm.name}
            onChange={e => setRecForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Home Loan EMI, Netflix, Rent"
            required
          />
          <Select
            label="Type"
            value={recForm.type}
            onChange={e => setRecForm(p => ({ ...p, type: e.target.value }))}
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Loan Amount (Optional)"
              type="number"
              value={recForm.loanAmount}
              onChange={e => setRecForm(p => ({ ...p, loanAmount: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Interest Rate % (Optional)"
              type="number"
              step="0.01"
              value={recForm.interestRate}
              onChange={e => setRecForm(p => ({ ...p, interestRate: e.target.value }))}
              placeholder="e.g. 8.5"
            />
          </div>

          <Input
            label="Monthly / EMI Amount"
            type="number"
            value={recForm.emiAmount}
            onChange={e => setRecForm(p => ({ ...p, emiAmount: e.target.value }))}
            placeholder="0.00"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Day of Month (1-31)"
              type="number"
              min="1"
              max="31"
              value={recForm.emiDate}
              onChange={e => setRecForm(p => ({ ...p, emiDate: e.target.value }))}
              placeholder="e.g. 5"
              required
            />
            <Input
              label="Total Installments"
              type="number"
              value={recForm.totalEMIs}
              onChange={e => setRecForm(p => ({ ...p, totalEMIs: e.target.value }))}
              placeholder="0 = ongoing"
            />
          </div>

          <DatePicker
            label="Start Date"
            name="startDate"
            value={recForm.startDate}
            onChange={e => setRecForm(p => ({ ...p, startDate: e.target.value }))}
            required
          />

          <Select
            label="Linked Account"
            value={recForm.accountId}
            onChange={e => setRecForm(p => ({ ...p, accountId: e.target.value }))}
          >
            <option value="">None</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>

          <Button type="submit" size="lg" loading={recFormLoading}>
            {editingRecurring ? 'Save Changes' : 'Add Recurring Commitment'}
          </Button>
        </form>
      </Sheet>
    </div>
  )
}


