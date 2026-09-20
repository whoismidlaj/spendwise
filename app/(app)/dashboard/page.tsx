'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CalendarDays, Landmark, WalletCards } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type PlanItem = {
  id: string; name: string; date: string; kind: 'INCOME' | 'PAYMENT'; source: string
  amount: number; reservedAmount: number; isEssential: boolean; status: string; accountName?: string; projectedBalance: number
}
type Plan = { items: PlanItem[]; summary: { bankBalance: number; expectedIncome: number; receivedIncome: number; requiredPayments: number; optionalPayments: number; cashBuffer: number; safeToSpend: number; lowestProjectedBalance: number; shortfall: number } }

function dateText(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [range, setRange] = useState(90)
  const [error, setError] = useState('')

  useEffect(() => {
    setPlan(null); setError('')
    fetch(`/api/plan?days=${range}`).then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to load your plan')
      return response.json()
    }).then(setPlan).catch(error => setError(error.message))
  }, [range])

  if (error) return <div className="p-4"><Card className="p-5 text-danger">{error}</Card></div>
  if (!plan) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /></div>
  const { summary, items } = plan
  const isShort = summary.lowestProjectedBalance < summary.cashBuffer

  return <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
    <section className="rounded-3xl bg-primary p-5 text-white shadow-md">
      <p className="text-sm text-white/75">Money available to plan</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{formatCurrency(summary.safeToSpend)}</p>
      <p className="mt-1 text-xs text-white/70">Bank balance + expected income − required payments − safety buffer</p>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center">
        <div><p className="text-[10px] text-white/65">In bank</p><p className="text-sm font-semibold">{formatCurrency(summary.bankBalance)}</p></div>
        <div><p className="text-[10px] text-white/65">Expected income</p><p className="text-sm font-semibold">{formatCurrency(summary.expectedIncome)}</p></div>
        <div><p className="text-[10px] text-white/65">Required</p><p className="text-sm font-semibold">{formatCurrency(summary.requiredPayments)}</p></div>
      </div>
    </section>

    {isShort && <Card className="border-danger/30 bg-danger/5 p-4"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-danger" size={19} /><div><p className="font-semibold text-danger">Your plan may fall short</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">The projected balance drops to {formatCurrency(summary.lowestProjectedBalance)}. Keep at least {formatCurrency(summary.cashBuffer)} aside, or adjust a payment before its due date.</p></div></div></Card>}

    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4"><p className="text-xs text-gray-500">Salary & income received</p><p className="mt-1 text-xl font-bold text-success">{formatCurrency(summary.receivedIncome)}</p><Link href="/income" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Manage income <ArrowRight size={13} /></Link></Card>
      <Card className="p-4"><p className="text-xs text-gray-500">Safety buffer</p><p className="mt-1 text-xl font-bold">{formatCurrency(summary.cashBuffer)}</p><Link href="/settings" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Change buffer <ArrowRight size={13} /></Link></Card>
    </div>

    <div className="flex items-center justify-between px-1"><div><h2 className="font-semibold">Payment flow</h2><p className="text-xs text-gray-500">Income and due payments, in order</p></div><div className="flex rounded-xl bg-surface-offset p-1 dark:bg-gray-800">{[30, 90].map(days => <button key={days} onClick={() => setRange(days)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${range === days ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500'}`}>{days}d</button>)}</div></div>
    <Card className="overflow-hidden divide-y divide-border dark:divide-gray-800">
      {items.slice(0, 12).map(item => <div key={item.id} className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.kind === 'INCOME' ? 'bg-success/10 text-success' : item.status === 'OVERDUE' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>{item.kind === 'INCOME' ? <Landmark size={17} /> : <CalendarDays size={17} />}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-gray-500">{dateText(item.date)} · {item.kind === 'INCOME' ? item.status === 'RECEIVED' ? 'received' : 'expected' : item.status === 'OVERDUE' ? 'overdue' : item.isEssential ? 'required' : 'optional'}{item.accountName ? ` · ${item.accountName}` : ''}</p></div>
        <div className={`text-right text-sm font-bold tabular-nums ${item.kind === 'INCOME' ? 'text-success' : ''}`}><p>{item.kind === 'INCOME' ? '+' : '−'}{formatCurrency(item.kind === 'PAYMENT' ? item.reservedAmount : item.amount)}</p><p className="text-[10px] font-medium text-gray-400">after: {formatCurrency(item.projectedBalance)}</p></div>
      </div>)}
      {items.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Add your salary and bills to start building a payment plan.</p>}
    </Card>
    <div className="grid grid-cols-2 gap-3"><Link href="/income"><Button className="w-full gap-2"><Landmark size={16} /> Add income</Button></Link><Link href="/bills"><Button variant="outline" className="w-full gap-2"><WalletCards size={16} /> Add bill</Button></Link></div>
    {items.some(item => item.kind === 'PAYMENT') && <Link href="/bills" className="block px-1 text-center text-sm font-semibold text-primary">View all upcoming payments</Link>}
  </div>
}
