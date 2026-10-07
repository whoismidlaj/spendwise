'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CalendarDays, CreditCard, HandCoins, Landmark, ReceiptText } from 'lucide-react'
import { Button, Card, SummaryCard } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type PlanItem = { reserves?: 'FULL' | 'MINIMUM' | 'NONE'; id: string; name: string; date: string; kind: 'INCOME' | 'PAYMENT'; amount: number; reservedAmount: number; isEssential: boolean; status: string; accountName?: string; projectedBalance: number }
type Plan = { unconfirmedIncome?: { sourceId: string; name: string; date: string; amount: number }[]; items: PlanItem[]; summary: { openingBalance: number; expectedIncome: number; requiredPayments: number; optionalPayments: number; cashBuffer: number; safeToSpend: number; lowestProjectedBalance: number } }

function dateText(date: string) { return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [period, setPeriod] = useState<'month' | 'next'>('month')
  const [error, setError] = useState('')

  useEffect(() => {
    setPlan(null); setError('')
    fetch(`/api/plan?period=${period}`).then(async response => { if (!response.ok) throw new Error((await response.json()).error || 'Unable to load your forecast'); return response.json() }).then(setPlan).catch(cause => setError(cause.message))
  }, [period])

  if (error) return <div className="p-4"><Card className="p-5 text-danger">{error}</Card></div>
  if (!plan) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /></div>

  const { summary, items } = plan
  const paymentItems = items.filter(item => item.kind === 'PAYMENT')
  const commitments = summary.requiredPayments + summary.optionalPayments
  const overdue = paymentItems.filter(item => item.status === 'OVERDUE').length
  const isShort = summary.lowestProjectedBalance < summary.cashBuffer

  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-4 sm:py-5">
    <SummaryCard label={period === 'month' ? 'Safe after this month' : 'Safe after next month'} value={formatCurrency(summary.safeToSpend)}
      detail={`Opening balance + income − required payments − safety buffer${summary.optionalPayments > 0 ? ` · ${formatCurrency(summary.optionalPayments)} of optional payments is not reserved` : ''}`}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {([['Opening', summary.openingBalance], ['Income', summary.expectedIncome], ['Required', summary.requiredPayments]] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="truncate text-[10px] text-white/75">{label}</dt><dd className="whitespace-nowrap text-xs font-semibold tabular-nums min-[390px]:text-sm">{formatCurrency(value)}</dd></div>)}
      </dl>
    </SummaryCard>

    {plan.unconfirmedIncome && plan.unconfirmedIncome.length > 0 && <Card className="border-warning/40 bg-warning/5 p-4"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-warning" size={19} aria-hidden /><div><p className="font-semibold">Confirm income that may already be in your balance</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{plan.unconfirmedIncome.map(item => `${item.name} (${formatCurrency(item.amount)}, ${dateText(item.date)})`).join(', ')} {plan.unconfirmedIncome.length === 1 ? 'is' : 'are'} left out of this forecast until confirmed. <Link href="/income" className="font-semibold text-primary underline">Confirm in Income</Link></p></div></div></Card>}

    {isShort && <Card className="border-danger/30 bg-danger/5 p-4"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-danger" size={19} /><div><p className="font-semibold text-danger">Your forecast may fall short</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">The projected balance drops below your {formatCurrency(summary.cashBuffer)} safety buffer. Review a payment before its due date.</p></div></div></Card>}

    <section className="space-y-2"><div className="flex items-end justify-between px-1"><div><h2 className="font-semibold">Monthly forecast</h2><p className="text-xs text-gray-500">What your commitments will cost</p></div><span className="text-xs font-medium text-gray-400">{paymentItems.length} due</span></div><div className="grid grid-cols-2 gap-2.5"><button onClick={() => setPeriod('month')} className={`rounded-2xl border p-3.5 text-left transition ${period === 'month' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-white dark:border-gray-800 dark:bg-gray-900'}`}><p className="text-xs text-gray-500">This month</p><p className="mt-1 text-lg font-bold">{period === 'month' ? formatCurrency(commitments) : 'View forecast'}</p><p className="mt-1 text-[11px] text-gray-500">{period === 'month' ? (overdue ? `${overdue} overdue` : 'On track') : 'Tap to preview'}</p></button><button onClick={() => setPeriod('next')} className={`rounded-2xl border p-3.5 text-left transition ${period === 'next' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-white dark:border-gray-800 dark:bg-gray-900'}`}><p className="text-xs text-gray-500">Next month</p><p className="mt-1 text-lg font-bold">{period === 'next' ? formatCurrency(commitments) : 'View forecast'}</p><p className="mt-1 text-[11px] text-gray-500">{period === 'next' ? `${paymentItems.length} planned payments` : 'Tap to preview'}</p></button></div></section>

    <div className="flex items-end justify-between px-1"><div><h2 className="font-semibold">{period === 'month' ? 'Commitments this month' : 'Commitments next month'}</h2><p className="text-xs text-gray-500">Track every payment before it is due</p></div><Link href="/payments" className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-primary">Open payments <ArrowRight size={13} aria-hidden /></Link></div>
    <Card className="overflow-hidden divide-y divide-border dark:divide-gray-800">{items.slice(0, 12).map(item => <div key={item.id} className="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${item.kind === 'INCOME' ? 'bg-success/10 text-success' : item.status === 'OVERDUE' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>{item.kind === 'INCOME' ? <Landmark size={16} /> : <CalendarDays size={16} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="truncate text-[11px] text-gray-500 sm:text-xs">{dateText(item.date)} · {item.kind === 'INCOME' ? 'expected income' : `${item.status === 'OVERDUE' ? 'overdue · ' : ''}${!item.isEssential ? 'optional · not reserved' : item.reserves === 'MINIMUM' ? `reserves minimum due of ${formatCurrency(item.amount)} bill` : 'required · reserves full amount'}`}{item.accountName ? ` · ${item.accountName}` : ''}</p></div><div className={`shrink-0 whitespace-nowrap text-right text-[13px] font-bold tabular-nums sm:text-sm ${item.kind === 'INCOME' ? 'text-success' : ''}`}><p>{item.kind === 'INCOME' ? '+' : '−'}{formatCurrency(item.kind === 'PAYMENT' ? item.reservedAmount : item.amount)}</p><p className="text-[9px] font-medium text-gray-400 sm:text-[10px]">after {formatCurrency(item.projectedBalance)}</p></div></div>)}{items.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Add a loan, recurring payment, or card bill to start your forecast.</p>}</Card>

    <section className="grid grid-cols-2 gap-2.5"><Link href="/accounts?section=recurring"><Card className="h-full p-3.5 transition hover:border-primary"><ReceiptText size={18} className="text-primary" aria-hidden /><p className="mt-3 text-sm font-semibold">Recurring</p><p className="mt-1 text-[11px] text-gray-500">Rent, utilities, subscriptions</p><p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Manage <ArrowRight size={13} aria-hidden /></p></Card></Link><Link href="/accounts?section=loans"><Card className="h-full p-3.5 transition hover:border-primary"><HandCoins size={18} className="text-primary" aria-hidden /><p className="mt-3 text-sm font-semibold">Loans &amp; debts</p><p className="mt-1 text-[11px] text-gray-500">EMIs, schedules, repayments</p><p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Manage <ArrowRight size={13} aria-hidden /></p></Card></Link></section>
    <div className="grid grid-cols-2 gap-3"><Link href="/income"><Button variant="outline" className="w-full gap-2"><Landmark size={16} /> Manage income</Button></Link><Link href="/accounts?section=cards"><Button variant="outline" className="w-full gap-2"><CreditCard size={16} aria-hidden /> Cards &amp; pay later</Button></Link></div>
  </div>
}
