'use client'
import { useEffect, useState } from 'react'
import { formatCurrency, remainingPrincipal } from '@/lib/currency'
import { Card, Button, Sheet, Input, Select, FAB, Badge, ProgressBar } from '@/components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Transaction { id: string; name: string; amount: number; type: string; date: string; category?: { name: string; icon: string; color: string } }
interface RecurringExpense {
  id: string; name: string; type: string; emiAmount: number; emiDate: number
  totalEMIs?: number; paidEMIs: number; loanAmount?: number; interestRate?: number
  account?: { name: string }; isActive: boolean
}
interface Account { id: string; name: string }
interface CategorySummary { categoryId: string; name: string; color: string; icon: string; total: number }

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
      <Input label="Start Date" type="date" value={form.startDate} onChange={f('startDate')} required />
      <Select label="Linked Account" value={form.accountId} onChange={f('accountId') as (e: React.ChangeEvent<HTMLSelectElement>) => void}>
        <option value="">None</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      <Button type="submit" size="lg" loading={loading}>Add Recurring Expense</Button>
    </form>
  )
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<'regular' | 'recurring'>('regular')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [summary, setSummary] = useState<CategorySummary[]>([])
  const [fabOpen, setFabOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [period, setPeriod] = useState('thisMonth')

  function getPeriodDates(p: string) {
    const now = new Date()
    if (p === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (p === 'lastMonth') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
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

  useEffect(() => { loadRegular() }, [period])
  useEffect(() => { loadRecurring() }, [])

  async function payEMI(id: string) {
    setPayingId(id)
    await fetch(`/api/recurring/${id}/pay`, { method: 'POST' })
    loadRecurring()
    setPayingId(null)
  }

  const filteredTxs = selectedCategory
    ? transactions.filter(tx => tx.category?.name === selectedCategory)
    : transactions

  function getNextDueDate(emiDate: number) {
    const now = new Date()
    const due = new Date(now.getFullYear(), now.getMonth(), emiDate)
    if (due < now) due.setMonth(due.getMonth() + 1)
    return due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="pb-4">
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {(['regular', 'recurring'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium flex-shrink-0',
              tab === t ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
            {t === 'regular' ? 'Regular Expenses' : 'Recurring'}
          </button>
        ))}
      </div>

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

      {tab === 'recurring' && (
        <div className="px-4 space-y-3">
          {recurring.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">No recurring expenses</p>
              <p className="text-sm">Tap + to add EMIs, subscriptions etc.</p>
            </div>
          )}
          {recurring.map(item => {
            const progress = item.totalEMIs ? (item.paidEMIs / item.totalEMIs) * 100 : 0
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

      {tab === 'recurring' && <FAB onClick={() => setFabOpen(true)} />}
      <Sheet open={fabOpen} onClose={() => setFabOpen(false)} title="Add Recurring Expense">
        <RecurringForm onSuccess={() => { setFabOpen(false); loadRecurring() }} />
      </Sheet>
    </div>
  )
}
