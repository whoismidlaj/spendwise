'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Plus } from 'lucide-react'
import { Button, Card, Input, Select, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type Account = { id: string; name: string }
type PaymentPlan = { id: string; name: string; type: string; amount: number; dueDay: number; isEssential: boolean; account?: Account; notes?: string }
type FlowItem = { id: string; name: string; kind: 'INCOME' | 'PAYMENT'; date: string; amount: number; reservedAmount: number; source: string; isEssential: boolean; status: string; projectedBalance: number }

export default function BillsPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [flow, setFlow] = useState<FlowItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [pay, setPay] = useState<PaymentPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', type: 'UTILITY', amount: '', dueDay: '', isEssential: true, accountId: '', notes: '' })
  const [payAmount, setPayAmount] = useState('')
  const f = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value }))
  const load = async () => {
    const [plansResponse, accountsResponse, flowResponse] = await Promise.all([fetch('/api/payment-plans'), fetch('/api/accounts'), fetch('/api/plan?days=30')])
    setPlans(await plansResponse.json()); setAccounts(await accountsResponse.json()); setFlow((await flowResponse.json()).items || [])
  }
  useEffect(() => { load() }, [])
  async function addPlan(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/payment-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), dueDay: Number(form.dueDay), accountId: form.accountId || null, notes: form.notes || null }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to create payment plan')
      setOpen(false); setForm({ name: '', type: 'UTILITY', amount: '', dueDay: '', isEssential: true, accountId: '', notes: '' }); load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create payment plan') } finally { setLoading(false) }
  }
  async function recordPayment(event: React.FormEvent) {
    event.preventDefault(); if (!pay) return; setLoading(true); setError('')
    const now = new Date(); const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(pay.dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())).toISOString().slice(0, 10)
    try {
      const response = await fetch(`/api/payment-plans/${pay.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate, amount: Number(payAmount), accountId: pay.account?.id }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record payment')
      setPay(null); setPayAmount(''); load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to record payment') } finally { setLoading(false) }
  }
  const dueSoon = flow.filter(item => item.kind === 'PAYMENT')
  return <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
    <Card className="bg-gradient-to-br from-primary to-primary-hover p-5 text-white"><p className="text-sm text-white/75">Upcoming required payments</p><p className="mt-1 text-3xl font-bold">{formatCurrency(dueSoon.filter(item => item.isEssential).reduce((sum, item) => sum + item.reservedAmount, 0))}</p><p className="mt-1 text-xs text-white/70">This includes your cards, EMIs, debts, and planned bills for the next 30 days.</p></Card>
    <Button id="add-payment-plan" onClick={() => { setError(''); setOpen(true) }} className="w-full gap-2"><Plus size={16} /> Add recurring bill</Button>
    <section><div className="mb-2 flex items-center justify-between px-1"><div><h2 className="font-semibold">Due next</h2><p className="text-xs text-gray-500">Cards, existing EMIs, debt repayments, and planned bills</p></div><CalendarDays className="text-primary" size={18} /></div><Card className="divide-y divide-border overflow-hidden dark:divide-gray-800">{dueSoon.slice(0, 12).map(item => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {item.status === 'OVERDUE' ? 'overdue' : item.isEssential ? 'required' : 'optional'} · {item.source}</p></div><p className="font-bold tabular-nums">{formatCurrency(item.reservedAmount)}</p></div>)}{dueSoon.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No payments are due in the next 30 days.</p>}</Card></section>
    <section><h2 className="mb-2 px-1 font-semibold">Your planned bills</h2><div className="space-y-3">{plans.map(plan => <Card key={plan.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="text-xs text-gray-500">Every month on the {plan.dueDay}th · {plan.isEssential ? 'required' : 'optional'}{plan.account ? ` · ${plan.account.name}` : ''}</p></div><p className="font-bold">{formatCurrency(plan.amount)}</p></div>{plan.notes && <p className="mt-2 text-xs text-gray-500">{plan.notes}</p>}<Button id={`pay-plan-${plan.id}`} size="sm" variant="outline" onClick={() => { setError(''); setPay(plan); setPayAmount(String(plan.amount)) }} className="mt-3 gap-1"><CheckCircle2 size={14} /> Record payment</Button></Card>)}</div></section>
    <p className="px-1 text-center text-xs text-gray-500">Manage card statements in <Link href="/accounts" className="font-semibold text-primary">Accounts</Link>, and loan or lending repayments in <Link href="/debts" className="font-semibold text-primary">Loans & Lending</Link>.</p>
    <Sheet open={open} onClose={() => setOpen(false)} title="Add recurring bill"><form onSubmit={addPlan} className="space-y-4 pb-4"><Input id="plan-name" label="Bill name" value={form.name} onChange={f('name')} placeholder="e.g. Electricity" required /><Select id="plan-type" label="Type" value={form.type} onChange={f('type')}><option value="RENT">Rent</option><option value="UTILITY">Utility</option><option value="SUBSCRIPTION">Subscription</option><option value="INSURANCE">Insurance</option><option value="FAMILY">Family support</option><option value="SAVINGS">Savings goal</option><option value="OTHER">Other</option></Select><div className="grid grid-cols-2 gap-3"><Input id="plan-amount" label="Monthly amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={f('amount')} required /><Input id="plan-due-day" label="Due day" type="number" min="1" max="31" value={form.dueDay} onChange={f('dueDay')} required /></div><Select id="plan-account" label="Pay from account" value={form.accountId} onChange={f('accountId')}><option value="">Choose later</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><label className="flex gap-2 text-sm"><input id="plan-essential" type="checkbox" checked={form.isEssential} onChange={f('isEssential')} /> Required payment</label><Input id="plan-notes" label="Notes (optional)" value={form.notes} onChange={f('notes')} />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button id="save-payment-plan" type="submit" loading={loading}>Add bill</Button></form></Sheet>
    <Sheet open={Boolean(pay)} onClose={() => setPay(null)} title="Record bill payment">{pay && <form onSubmit={recordPayment} className="space-y-4 pb-4"><p className="rounded-xl bg-surface-offset p-3 text-sm">Paying <strong>{pay.name}</strong> from {pay.account?.name || 'your selected account'}.</p><Input id="planned-payment-amount" label="Amount paid" type="number" min="0.01" step="0.01" value={payAmount} onChange={event => setPayAmount(event.target.value)} required />{!pay.account && <p className="text-sm text-danger">Edit this bill to link an account before recording its payment.</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button id="confirm-planned-payment" type="submit" loading={loading} disabled={!pay.account}>Record payment</Button></form>}</Sheet>
  </div>
}
