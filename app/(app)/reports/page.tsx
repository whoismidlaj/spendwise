'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card } from '@/components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendData { month: number; year: number; label: string; income: number; expense: number }
interface CategoryData { categoryId: string; name: string; color: string; icon: string; total: number }

export default function ReportsPage() {
  const [period, setPeriod] = useState('thisMonth')
  const [trends, setTrends] = useState<TrendData[]>([])
  const [summary, setSummary] = useState<{ totalIncome: number; totalExpense: number; netSavings: number; byCategory: CategoryData[] }>({
    totalIncome: 0, totalExpense: 0, netSavings: 0, byCategory: [],
  })
  const [loading, setLoading] = useState(true)

  function getPeriodDates(p: string) {
    const now = new Date()
    if (p === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (p === 'last3Months') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    if (p === 'thisYear') return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) }
    return { start: new Date(2000, 0, 1), end: new Date() }
  }

  async function load() {
    setLoading(true)
    const { start, end } = getPeriodDates(period)
    const [sum, tr] = await Promise.all([
      fetch(`/api/reports/summary?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).then(r => r.json()),
      fetch(`/api/reports/trends?months=6`).then(r => r.json()),
    ])
    setSummary(sum)
    setTrends(tr)
    setLoading(false)
  }

  useEffect(() => { load() }, [period])

  async function exportCSV() {
    const { start, end } = getPeriodDates(period)
    const res = await fetch(`/api/transactions?startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=10000`)
    const data = await res.json()
    const txs = data.transactions || []
    const rows = [
      ['Date', 'Name', 'Type', 'Amount', 'Category', 'Account'],
      ...txs.map((tx: { date: string; name: string; type: string; amount: number; category?: { name: string }; account?: { name: string } }) => [
        new Date(tx.date).toLocaleDateString('en-IN'),
        tx.name, tx.type, tx.amount,
        tx.category?.name ?? '', tx.account?.name ?? '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `spendwise-${period}.csv`; a.click()
  }

  const top5 = [...(summary.byCategory || [])].sort((a, b) => b.total - a.total).slice(0, 5)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null
    return (
      <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-700 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-medium mb-1 dark:text-white">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Period + Export */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[['thisMonth', 'This Month'], ['last3Months', 'Last 3M'], ['thisYear', 'This Year']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0',
                period === v ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-surface-offset dark:hover:bg-gray-800">
          <Download size={13} />Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Income</p>
          <p className="text-sm font-bold text-success tabular-nums">{formatCurrency(summary.totalIncome)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Expenses</p>
          <p className="text-sm font-bold text-danger tabular-nums">{formatCurrency(summary.totalExpense)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Savings</p>
          <p className={cn('text-sm font-bold tabular-nums', summary.netSavings >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(summary.netSavings)}</p>
        </Card>
      </div>

      {/* Income vs Expense Bar Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold dark:text-white mb-3">Income vs Expense (6 months)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={v => v.split(' ')[0]} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v/1000}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="income" name="Income" fill="#437a22" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="#a12c7b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Category Donut */}
      {summary.byCategory.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold dark:text-white mb-3">Expense by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={summary.byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                {summary.byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend formatter={v => <span className="text-xs dark:text-gray-300">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top Spending */}
      {top5.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold dark:text-white mb-3">Top Spending Categories</h3>
          <div className="space-y-3">
            {top5.map(cat => (
              <div key={cat.categoryId}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="dark:text-gray-300">{cat.icon} {cat.name}</span>
                  <span className="font-semibold tabular-nums dark:text-white">{formatCurrency(cat.total)}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(cat.total / top5[0].total) * 100}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily Spending Area Chart */}
      {trends.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold dark:text-white mb-3">Monthly Spending Trend</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a12c7b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a12c7b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={v => v.split(' ')[0]} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#a12c7b" fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
