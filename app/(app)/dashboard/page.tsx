'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CalendarDays, Landmark, WalletCards } from 'lucide-react'
import { Button, Card, FAB, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'
import { QuickTransactionForm } from '@/components/QuickTransactionForm'

type PlanItem = {
  id: string; name: string; date: string; kind: 'INCOME' | 'PAYMENT'; source: string
  amount: number; reservedAmount: number; isEssential: boolean; status: string; accountName?: string; projectedBalance: number
}
type Plan = { items: PlanItem[]; summary: { bankBalance: number; openingBalance: number; expectedIncome: number; receivedIncome: number; requiredPayments: number; optionalPayments: number; cashBuffer: number; safeToSpend: number; lowestProjectedBalance: number; shortfall: number } }

function dateText(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [period, setPeriod] = useState<'month' | 'next'>('month')
  const [error, setError] = useState('')
  const [quickEntryOpen, setQuickEntryOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setPlan(null); setError('')
    fetch(`/api/plan?period=${period}`).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to load your plan')
      return response.json()
    }).then(setPlan).catch(error => setError(error.message))
  }, [period, refreshKey])

  if (error) return <div className="p-4"><Card className="p-5 text-danger">{error}</Card></div>
  if (!plan) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /></div>
  const { summary, items } = plan
  const isShort = summary.lowestProjectedBalance < summary.cashBuffer

  return <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
    <section className="rounded-2xl bg-primary p-4 text-white shadow-md sm:rounded-3xl sm:p-5">
      <p className="text-sm text-white/75">{period === 'month' ? 'Money available to plan' : 'Money available next month'}</p>
      <p className="mt-1 whitespace-nowrap text-3xl font-bold tabular-nums">{formatCurrency(summary.safeToSpend)}</p>
      <p className="mt-1 text-xs text-white/70">{period === 'month' ? 'Bank balance' : 'Projected opening'} + expected income − required payments − safety buffer</p>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center">
        <div className="min-w-0"><p className="truncate text-[10px] text-white/65">{period === 'month' ? 'In bank' : 'Projected opening'}</p><p className="whitespace-nowrap text-xs font-semibold min-[390px]:text-sm">{formatCurrency(summary.openingBalance)}</p></div>
        <div className="min-w-0"><p className="truncate text-[10px] text-white/65">Expected income</p><p className="whitespace-nowrap text-xs font-semibold min-[390px]:text-sm">{formatCurrency(summary.expectedIncome)}</p></div>
        <div className="min-w-0"><p className="truncate text-[10px] text-white/65">Required</p><p className="whitespace-nowrap text-xs font-semibold min-[390px]:text-sm">{formatCurrency(summary.requiredPayments)}</p></div>
      </div>
    </section>

    {isShort && <Card className="border-danger/30 bg-danger/5 p-4"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-danger" size={19} /><div><p className="font-semibold text-danger">Your plan may fall short</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">The projected balance drops to {formatCurrency(summary.lowestProjectedBalance)}. Keep at least {formatCurrency(summary.cashBuffer)} aside, or adjust a payment before its due date.</p></div></div></Card>}

    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <Card className="min-w-0 p-3.5 sm:p-4"><p className="truncate text-xs text-gray-500">Income received</p><p className="mt-1 truncate text-lg font-bold text-success min-[390px]:text-xl">{formatCurrency(summary.receivedIncome)}</p><Link href="/income" className="mt-2 inline-flex max-w-full items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary">Manage income <ArrowRight size={13} /></Link></Card>
      <Card className="min-w-0 p-3.5 sm:p-4"><p className="truncate text-xs text-gray-500">Safety buffer</p><p className="mt-1 truncate text-lg font-bold min-[390px]:text-xl">{formatCurrency(summary.cashBuffer)}</p><Link href="/settings" className="mt-2 inline-flex max-w-full items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary">Change buffer <ArrowRight size={13} /></Link></Card>
    </div>

    <div className="space-y-2.5 px-1"><div><h2 className="font-semibold">{period === 'month' ? 'This month’s payment flow' : 'Next month’s payment flow'}</h2><p className="text-xs text-gray-500">Expected income and payments for the selected month</p></div><div className="grid grid-cols-2 rounded-xl bg-surface-offset p-1 dark:bg-gray-800"><button onClick={() => setPeriod('month')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === 'month' ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500'}`}>This month</button><button onClick={() => setPeriod('next')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === 'next' ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500'}`}>Next month</button></div></div>
    <Card className="overflow-hidden divide-y divide-border dark:divide-gray-800">
      {items.slice(0, 12).map(item => <div key={item.id} className="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${item.kind === 'INCOME' ? 'bg-success/10 text-success' : item.status === 'OVERDUE' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>{item.kind === 'INCOME' ? <Landmark size={16} /> : <CalendarDays size={16} />}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="truncate text-[11px] text-gray-500 sm:text-xs">{dateText(item.date)} · {item.kind === 'INCOME' ? item.status === 'RECEIVED' ? 'received' : 'expected' : item.status === 'OVERDUE' ? 'overdue' : item.isEssential ? 'required' : 'optional'}{item.accountName ? ` · ${item.accountName}` : ''}</p></div>
        <div className={`shrink-0 whitespace-nowrap text-right text-[13px] font-bold tabular-nums sm:text-sm ${item.kind === 'INCOME' ? 'text-success' : ''}`}><p>{item.kind === 'INCOME' ? '+' : '−'}{formatCurrency(item.kind === 'PAYMENT' ? item.reservedAmount : item.amount)}</p><p className="text-[9px] font-medium text-gray-400 sm:text-[10px]">after {formatCurrency(item.projectedBalance)}</p></div>
      </div>)}
      {items.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Add your salary and bills to start building a payment plan.</p>}
    </Card>
    <div className="grid grid-cols-2 gap-3"><Link href="/income"><Button className="w-full gap-2"><Landmark size={16} /> Add income</Button></Link><Link href="/bills"><Button variant="outline" className="w-full gap-2"><WalletCards size={16} /> Add bill</Button></Link></div>
    <FAB onClick={() => setQuickEntryOpen(true)} />
    <Sheet open={quickEntryOpen} onClose={() => setQuickEntryOpen(false)} title="Add transaction">
      <QuickTransactionForm onSuccess={() => { setQuickEntryOpen(false); setRefreshKey(value => value + 1) }} />
    </Sheet>
  </div>
}
