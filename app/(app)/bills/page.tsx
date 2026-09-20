'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Input, Select, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type Account = { id: string; name: string }
type Bill = { id: string; name: string; type: string; amount: number; dueDay: number; isEssential: boolean; account?: Account; notes?: string }
type BillForm = { name: string; type: string; amount: string; dueDay: string; isEssential: boolean; accountId: string; notes: string }

const emptyForm = (): BillForm => ({ name: '', type: 'UTILITY', amount: '', dueDay: '', isEssential: true, accountId: '', notes: '' })
const labels: Record<string, string> = { RENT: 'Rent', UTILITY: 'Utility', SUBSCRIPTION: 'Subscription', INSURANCE: 'Insurance', FAMILY: 'Family support', SAVINGS: 'Savings', OTHER: 'Other' }

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState<BillForm>(emptyForm)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [paying, setPaying] = useState<Bill | null>(null)
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof BillForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value }))

  const load = async () => {
    const [billResponse, accountResponse] = await Promise.all([fetch('/api/payment-plans'), fetch('/api/accounts')])
    setBills(await billResponse.json()); setAccounts(await accountResponse.json())
  }
  useEffect(() => { load() }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch(editing ? `/api/payment-plans/${editing.id}` : '/api/payment-plans', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), dueDay: Number(form.dueDay), accountId: form.accountId || null, notes: form.notes || null }),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save bill')
      setFormOpen(false); setEditing(null); setForm(emptyForm()); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save bill') } finally { setLoading(false) }
  }

  function edit(bill: Bill) {
    setError(''); setEditing(bill); setForm({ name: bill.name, type: bill.type, amount: String(bill.amount), dueDay: String(bill.dueDay), isEssential: bill.isEssential, accountId: bill.account?.id || '', notes: bill.notes || '' }); setFormOpen(true)
  }

  async function remove(bill: Bill) {
    if (!confirm(`Delete ${bill.name}?`)) return
    await fetch(`/api/payment-plans/${bill.id}`, { method: 'DELETE' }); load()
  }

  async function recordPayment(event: React.FormEvent) {
    event.preventDefault(); if (!paying) return; setLoading(true); setError('')
    const now = new Date()
    const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(paying.dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())).toISOString().slice(0, 10)
    try {
      const response = await fetch(`/api/payment-plans/${paying.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dueDate, amount: Number(paidAmount), accountId: paymentAccountId }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record payment')
      setPaying(null); setPaidAmount(''); setPaymentAccountId(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment') } finally { setLoading(false) }
  }

  const monthlyTotal = bills.reduce((sum, bill) => sum + Number(bill.amount), 0)
  const requiredTotal = bills.filter(bill => bill.isEssential).reduce((sum, bill) => sum + Number(bill.amount), 0)

  return <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
    <Card className="bg-gradient-to-br from-primary to-primary-hover p-4 text-white sm:p-5"><p className="text-sm text-white/75">Monthly recurring payments</p><p className="mt-1 whitespace-nowrap text-3xl font-bold">{formatCurrency(monthlyTotal)}</p><div className="mt-3 truncate border-t border-white/15 pt-3 text-xs text-white/75">{formatCurrency(requiredTotal)} required · {bills.length} active payments</div></Card>
    <Button onClick={() => { setError(''); setEditing(null); setForm(emptyForm()); setFormOpen(true) }} className="w-full gap-2"><Plus size={16} /> Add recurring payment</Button>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {bills.length === 0 ? <Card className="p-8 text-center text-sm text-gray-500">No recurring bills yet.</Card> : <div className="space-y-3">{bills.map(bill => <Card key={bill.id} className="p-3.5 sm:p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5"><div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate font-semibold">{bill.name}</p><Badge className="shrink-0 bg-primary/10 text-[10px] text-primary">{labels[bill.type] || bill.type}</Badge>{!bill.isEssential && <Badge className="shrink-0 bg-gray-100 text-[10px] text-gray-500 dark:bg-gray-800">Optional</Badge>}</div><p className="mt-1 truncate text-[11px] text-gray-500 sm:text-xs">Day {bill.dueDay}{bill.account ? ` · ${bill.account.name}` : ' · choose account when paying'}</p>{bill.notes && <p className="mt-2 truncate text-xs text-gray-500">{bill.notes}</p>}</div><p className="whitespace-nowrap text-sm font-bold min-[390px]:text-base">{formatCurrency(bill.amount)}</p></div><div className="mt-3 flex justify-end gap-2 border-t border-border pt-3 dark:border-gray-800"><Button size="sm" variant="outline" onClick={() => edit(bill)} className="shrink-0"><Pencil size={13} /></Button><Button size="sm" variant="outline" onClick={() => remove(bill)} className="shrink-0 text-danger"><Trash2 size={13} /></Button><Button size="sm" onClick={() => { setError(''); setPaying(bill); setPaidAmount(String(bill.amount)); setPaymentAccountId(bill.account?.id || '') }} className="shrink-0 gap-1"><CheckCircle2 size={13} /> Paid</Button></div></Card>)}</div>}
    <p className="px-1 text-center text-xs text-gray-500">Loans and EMIs belong in <Link href="/debts" className="font-semibold text-primary">Loans</Link>. Card statements belong in <Link href="/accounts" className="font-semibold text-primary">Accounts</Link>.</p>

    <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit recurring bill' : 'Add recurring bill'}><form onSubmit={save} className="space-y-4 pb-4"><Input label="Bill name" value={form.name} onChange={set('name')} placeholder="e.g. Electricity" required /><Select label="Type" value={form.type} onChange={set('type')}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Monthly amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required /><Input label="Due day" type="number" min="1" max="31" value={form.dueDay} onChange={set('dueDay')} required /></div><Select label="Pay from account" value={form.accountId} onChange={set('accountId')}><option value="">Choose when paying</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><label className="flex items-center gap-2 rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800"><input type="checkbox" checked={form.isEssential} onChange={set('isEssential')} /> Required monthly payment</label><Input label="Notes (optional)" value={form.notes} onChange={set('notes')} />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading}>{editing ? 'Save changes' : 'Add bill'}</Button></form></Sheet>
    <Sheet open={Boolean(paying)} onClose={() => { setPaying(null); setPaymentAccountId('') }} title="Record bill payment">{paying && <form onSubmit={recordPayment} className="space-y-4 pb-4"><p className="rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800">{paying.name} · due day {paying.dueDay}</p><Input label="Amount paid" type="number" min="0.01" step="0.01" value={paidAmount} onChange={event => setPaidAmount(event.target.value)} required /><Select label="Pay from account" value={paymentAccountId} onChange={event => setPaymentAccountId(event.target.value)} required><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading} disabled={!paymentAccountId}>Record payment</Button></form>}</Sheet>
  </div>
}
