'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, Plus } from 'lucide-react'
import { Badge, Button, Card, Input, Select, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type Account = { id: string; name: string }
type Obligation = { id: string; name: string; date: string; kind: 'INCOME' | 'PAYMENT'; amount: number; reservedAmount: number; source: string; status: string; isEssential: boolean }
type Plan = { items: Obligation[] }

const labels: Record<string, string> = { RENT: 'Rent', UTILITY: 'Utility', SUBSCRIPTION: 'Subscription', INSURANCE: 'Insurance', FAMILY: 'Family support', SAVINGS: 'Savings', OTHER: 'Other' }

function dayLabel(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function paymentTarget(item: Obligation) {
  if (item.id.startsWith('plan-')) return { type: 'plan' as const, id: item.id.slice(5, -11) }
  if (item.id.startsWith('debt-deadline-')) return { type: 'debt' as const, id: item.id.slice('debt-deadline-'.length) }
  if (item.id.startsWith('debt-')) return { type: 'debt' as const, id: item.id.slice(5, -11) }
  if (item.id.startsWith('card-')) return { type: 'card' as const, id: item.id.slice(5) }
  return null
}

export default function BillsPage() {
  const [items, setItems] = useState<Obligation[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState<Obligation | null>(null)
  const [accountId, setAccountId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'UTILITY', amount: '', dueDay: '', isEssential: true })

  async function load() {
    setLoading(true); setError('')
    try {
      const [planResponse, accountResponse] = await Promise.all([fetch('/api/plan?period=month'), fetch('/api/accounts')])
      if (!planResponse.ok) throw new Error((await planResponse.json()).error || 'Unable to load payments')
      const plan: Plan = await planResponse.json()
      setItems(plan.items.filter(item => item.kind === 'PAYMENT').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      setAccounts(await accountResponse.json())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load payments') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function markPaid() {
    if (!paying) return
    const target = paymentTarget(paying)
    if (!target) return
    setSaving(true); setError('')
    try {
      let response: Response
      if (target.type === 'plan') response = await fetch(`/api/payment-plans/${target.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate: paying.date.slice(0, 10), amount: Number(paying.amount), accountId }) })
      else if (target.type === 'debt') response = await fetch(`/api/debts/${target.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(paying.amount), paidDate: paying.date.slice(0, 10), accountId: accountId || undefined }) })
      else response = await fetch(`/api/credit-cards/${target.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(paying.amount), accountId: accountId || undefined }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to mark payment')
      setPaying(null); setAccountId(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to mark payment') } finally { setSaving(false) }
  }

  async function addRecurring(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch('/api/payment-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), dueDay: Number(form.dueDay), accountId: null }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to add payment')
      setAddOpen(false); setForm({ name: '', type: 'UTILITY', amount: '', dueDay: '', isEssential: true }); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add payment') } finally { setSaving(false) }
  }

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const overdue = items.filter(item => item.status === 'OVERDUE').length

  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-3 sm:space-y-5 sm:px-4 sm:py-4">
    <Card className="bg-gradient-to-br from-primary to-primary-hover p-4 text-white sm:p-5"><p className="text-sm text-white/75">Payments this month</p><p className="mt-1 whitespace-nowrap text-3xl font-bold tabular-nums">{formatCurrency(total)}</p><p className="mt-2 text-xs text-white/70">{items.length} obligation{items.length === 1 ? '' : 's'} · {overdue ? `${overdue} overdue` : 'Nothing overdue'}</p></Card>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex items-end justify-between px-1"><div><h2 className="font-semibold">Upcoming obligations</h2><p className="text-xs text-gray-500">Tap paid after each payment goes out</p></div><Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1"><Plus size={14} /> Add</Button></div>
    {loading ? <Card className="p-8 text-center text-sm text-gray-500">Loading payments…</Card> : items.length === 0 ? <Card className="p-8 text-center"><CalendarClock className="mx-auto text-gray-400" /><p className="mt-2 font-semibold">No payments this month</p><p className="mt-1 text-sm text-gray-500">Add a recurring payment, loan, or card bill to see it here.</p></Card> : <Card className="divide-y divide-border overflow-hidden dark:divide-gray-800">{items.map(item => <div key={item.id} className="flex items-center gap-3 px-3.5 py-3.5"><div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl ${item.status === 'OVERDUE' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}><CalendarClock size={15} /><span className="text-[9px] font-bold">{new Date(item.date).getDate()}</span></div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-semibold">{item.name}</p>{item.status === 'OVERDUE' && <Badge className="bg-danger/10 text-[10px] text-danger">Overdue</Badge>}</div><p className="mt-0.5 truncate text-[11px] text-gray-500">{dayLabel(item.date)} · {item.isEssential ? 'Required' : 'Optional'} · {item.source === 'DEBT' ? 'Loan/debt' : item.source === 'CARD' || item.source === 'PAY_LATER' ? 'Card bill' : 'Recurring'}</p></div><div className="shrink-0 text-right"><p className="text-sm font-bold tabular-nums">{formatCurrency(item.amount)}</p><Button size="sm" className="mt-1 gap-1" onClick={() => { setPaying(item); setAccountId('') }}><CheckCircle2 size={13} /> Paid</Button></div></div>)}</Card>}
    <p className="px-1 text-center text-xs text-gray-500">Loans, debts, and card bills appear here automatically from Accounts.</p>

    <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} title="Mark payment as paid">{paying && <div className="space-y-4 pb-4"><div className="rounded-xl bg-surface-offset p-3 dark:bg-gray-800"><p className="font-semibold">{paying.name}</p><p className="mt-1 text-sm text-gray-500">{dayLabel(paying.date)} · {formatCurrency(paying.amount)}</p></div><Select label="Paid from account" value={accountId} onChange={event => setAccountId(event.target.value)} required><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button loading={saving} onClick={markPaid} disabled={!accountId}>Mark paid</Button></div>}</Sheet>
    <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add recurring payment"><form onSubmit={addRecurring} className="space-y-4 pb-4"><Input label="Payment name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Electricity" required /><Select label="Type" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><div className="grid grid-cols-2 gap-3"><Input label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} required /><Input label="Due day" type="number" min="1" max="31" value={form.dueDay} onChange={event => setForm(current => ({ ...current, dueDay: event.target.value }))} required /></div><label className="flex items-center gap-2 rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800"><input type="checkbox" checked={form.isEssential} onChange={event => setForm(current => ({ ...current, isEssential: event.target.checked }))} /> Required payment</label><Button type="submit" loading={saving}>Add payment</Button></form></Sheet>
  </div>
}
