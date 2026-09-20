'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, CreditCard, ReceiptText } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

type Transaction = {
  id: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amount: number
  name: string
  date: string
  managedPayment: boolean
  account?: { id: string; name: string }
  toAccount?: { id: string; name: string }
  creditCard?: { id: string; name: string; bank: string; type: string }
}

type Filter = 'ALL' | Transaction['type']

function dateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dateKey(value) === dateKey(today.toISOString())) return 'Today'
  if (dateKey(value) === dateKey(yesterday.toISOString())) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function sourceLabel(item: Transaction) {
  if (item.type === 'TRANSFER' && item.creditCard) return `${item.account?.name || 'External'} → ${item.creditCard.name}`
  if (item.creditCard) return `${item.creditCard.bank} · ${item.creditCard.name}`
  if (item.type === 'TRANSFER') return `${item.account?.name || 'External'} → ${item.toAccount?.name || 'External'}`
  return item.account?.name || item.toAccount?.name || 'No account change'
}

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/transactions?limit=200').then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to load history')
      return response.json()
    }).then(data => setTransactions(data.transactions || [])).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load history')).finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const filtered = filter === 'ALL' ? transactions : transactions.filter(item => item.type === filter)
    return filtered.reduce<Record<string, Transaction[]>>((result, item) => {
      const key = dateKey(item.date)
      ;(result[key] ||= []).push(item)
      return result
    }, {})
  }, [transactions, filter])

  return <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:px-4 sm:py-4">
    <div className="grid grid-cols-4 rounded-xl bg-surface-offset p-1 dark:bg-gray-800">
      {([['ALL', 'All'], ['EXPENSE', 'Payments'], ['TRANSFER', 'Transfers'], ['INCOME', 'Income']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn('truncate rounded-lg px-1.5 py-2 text-[11px] font-semibold min-[390px]:text-xs', filter === value ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500')}>{label}</button>)}
    </div>

    {error && <Card className="p-4 text-sm text-danger">{error}</Card>}
    {loading ? <p className="py-10 text-center text-sm text-gray-500">Loading history…</p> : Object.keys(groups).length === 0 ? <Card className="p-8 text-center"><ReceiptText className="mx-auto text-gray-400" /><p className="mt-2 font-semibold">No activity yet</p><p className="mt-1 text-xs text-gray-500">Payments and balance changes will appear here.</p></Card> : Object.entries(groups).map(([key, items]) => <section key={key} className="space-y-1.5">
      <h2 className="px-1 text-xs font-semibold text-gray-500">{dateLabel(items[0].date)}</h2>
      <Card className="divide-y divide-border overflow-hidden dark:divide-gray-800">
        {items.map(item => {
          const Icon = item.type === 'TRANSFER' ? ArrowRightLeft : item.type === 'INCOME' ? ArrowDownLeft : item.creditCard ? CreditCard : ReceiptText
          return <div key={item.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-3">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', item.type === 'INCOME' ? 'bg-success/10 text-success' : item.type === 'EXPENSE' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary')}><Icon size={16} /></div>
            <div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-semibold">{item.name}</p>{item.managedPayment && <Badge className="shrink-0 bg-surface-offset px-1.5 text-[9px] text-gray-500 dark:bg-gray-800">Auto</Badge>}</div><p className="truncate text-[11px] text-gray-500">{sourceLabel(item)}</p></div>
            <div className="shrink-0 whitespace-nowrap text-right"><p className={cn('text-sm font-bold tabular-nums', item.type === 'INCOME' ? 'text-success' : item.type === 'EXPENSE' ? 'text-danger' : '')}>{item.type === 'INCOME' ? '+' : item.type === 'EXPENSE' ? '−' : ''}{formatCurrency(item.amount)}</p><p className="text-[9px] text-gray-400">{new Date(item.date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p></div>
          </div>
        })}
      </Card>
    </section>)}
  </div>
}
