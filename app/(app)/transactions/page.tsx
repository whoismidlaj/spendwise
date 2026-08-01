'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card, FAB, Sheet, Badge } from '@/components/ui'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { Trash2, Edit2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string; name: string; amount: number; type: string; date: string
  category?: { name: string; icon: string; color: string }
  account?: { name: string }
  creditCard?: { name: string }
}

interface Account { id: string; name: string }
interface CreditCard { id: string; name: string }

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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [total, setTotal] = useState(0)
  const [fabOpen, setFabOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    accountId: '', type: 'ALL', period: 'thisMonth', search: '',
  })

  function getPeriodDates(period: string) {
    const now = new Date()
    if (period === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (period === 'lastMonth') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }
    if (period === 'last3Months') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    return { start: new Date(2000, 0, 1), end: new Date() }
  }

  const load = useCallback(async () => {
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

  useEffect(() => {
    Promise.all([fetch('/api/accounts').then(r => r.json()), fetch('/api/credit-cards').then(r => r.json())])
      .then(([a, c]) => { setAccounts(a); setCards(c) })
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteTx(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    load()
  }

  const grouped = groupByDate(transactions)

  return (
    <div className="pb-4">
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
            <option value="ALL">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
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
                      <button onClick={() => setEditTx(tx)} className="p-1.5 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                        <Edit2 size={13} className="text-gray-400" />
                      </button>
                      <button onClick={() => deleteTx(tx.id)} className="p-1.5 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
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

      <FAB onClick={() => setFabOpen(true)} />

      <Sheet open={fabOpen} onClose={() => setFabOpen(false)} title="Add Transaction">
        <TransactionForm onSuccess={() => { setFabOpen(false); load() }} />
      </Sheet>

      <Sheet open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        {editTx && (
          <TransactionForm
            onSuccess={() => { setEditTx(null); load() }}
            initial={{ id: editTx.id, type: editTx.type as 'EXPENSE' | 'INCOME', amount: String(editTx.amount), name: editTx.name, date: editTx.date.slice(0, 10) }}
          />
        )}
      </Sheet>
    </div>
  )
}
