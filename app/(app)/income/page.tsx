'use client'

import { useEffect, useState } from 'react'
import { HandCoins, Landmark, Plus, CheckCircle2, Edit2, Trash2 } from 'lucide-react'
import { Button, Card, DatePicker, Input, Select, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'

type Account = { id: string; name: string }
type Source = { id: string; name: string; type: string; frequency: string; payday?: number; grossAmount?: number; expectedInHand: number; defaultDeductions: number; account?: Account; occurrences: { expectedDate: string; actualAmount?: number; status: string }[] }
type Owed = { id: string; name: string; amount: number; remaining: number; deadline?: string; payments: { amount: number; paidDate: string }[] }

export default function IncomePage() {
  const [sources, setSources] = useState<Source[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [owed, setOwed] = useState<Owed[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [edit, setEdit] = useState<Source | null>(null)
  const [receive, setReceive] = useState<Source | null>(null)
  const [addOwedOpen, setAddOwedOpen] = useState(false)
  const [receiveOwed, setReceiveOwed] = useState<Owed | null>(null)
  const [owedForm, setOwedForm] = useState({ name: '', amount: '', deadline: '' })
  const [owedAmount, setOwedAmount] = useState('')
  const [owedAccountId, setOwedAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: 'Salary', type: 'SALARY', payday: '', grossAmount: '', expectedInHand: '', defaultDeductions: '', accountId: '' })
  const [receivedAmount, setReceivedAmount] = useState('')
  const f = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.value }))
  const load = async () => {
    const [sourceResponse, accountResponse, owedResponse] = await Promise.all([fetch('/api/income-sources'), fetch('/api/accounts'), fetch('/api/debts')])
    setSources(await sourceResponse.json()); setAccounts(await accountResponse.json()); setOwed((await owedResponse.json()).filter((item: Owed & { direction: string; isActive: boolean }) => item.direction === 'LENT' && item.isActive))
  }
  useEffect(() => { load() }, [])
  const today = new Date()
  const expectedDate = (source: Source) => new Date(today.getFullYear(), today.getMonth(), Math.min(source.payday || today.getDate(), new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())).toISOString().slice(0, 10)

  async function addSource(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/income-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, payday: Number(form.payday), grossAmount: form.grossAmount ? Number(form.grossAmount) : null, expectedInHand: Number(form.expectedInHand), defaultDeductions: Number(form.defaultDeductions || 0), accountId: form.accountId || null }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save income source')
      setAddOpen(false); setForm({ name: 'Salary', type: 'SALARY', payday: '', grossAmount: '', expectedInHand: '', defaultDeductions: '', accountId: '' }); load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save income source') } finally { setLoading(false) }
  }
  function editSource(source: Source) {
    setError(''); setEdit(source)
    setForm({ name: source.name, type: source.type, payday: String(source.payday || ''), grossAmount: source.grossAmount ? String(source.grossAmount) : '', expectedInHand: String(source.expectedInHand), defaultDeductions: String(source.defaultDeductions || ''), accountId: source.account?.id || '' })
  }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault(); if (!edit) return; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/income-sources/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, payday: Number(form.payday), grossAmount: form.grossAmount ? Number(form.grossAmount) : null, expectedInHand: Number(form.expectedInHand), defaultDeductions: Number(form.defaultDeductions || 0), accountId: form.accountId || null }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to update income source')
      setEdit(null); load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update income source') } finally { setLoading(false) }
  }
  async function removeSource(source: Source) {
    if (!confirm(`Remove ${source.name} from future income planning? Past received income will be kept.`)) return
    setError('')
    const response = await fetch(`/api/income-sources/${source.id}`, { method: 'DELETE' })
    if (!response.ok) { setError((await response.json()).error || 'Unable to remove income source'); return }
    load()
  }
  async function receiveIncome(event: React.FormEvent) {
    event.preventDefault(); if (!receive) return; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/income-sources/${receive.id}/receive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedDate: expectedDate(receive), amount: Number(receivedAmount), accountId: receive.account?.id }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record income')
      setReceive(null); setReceivedAmount(''); load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to record income') } finally { setLoading(false) }
  }
  async function addOwed(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: owedForm.name, direction: 'LENT', type: 'PERSONAL', amount: Number(owedForm.amount), isRecurring: false, deadline: owedForm.deadline || null, interestRate: 0, priority: 'MEDIUM' }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to add money owed')
      setAddOwedOpen(false); setOwedForm({ name: '', amount: '', deadline: '' }); load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add money owed') } finally { setLoading(false) }
  }
  async function recordOwedReceived(event: React.FormEvent) {
    event.preventDefault(); if (!receiveOwed) return; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/debts/${receiveOwed.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(owedAmount), accountId: owedAccountId || undefined }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record receipt')
      setReceiveOwed(null); setOwedAmount(''); setOwedAccountId(''); load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record receipt') } finally { setLoading(false) }
  }
  const totalInHand = sources.reduce((sum, source) => sum + Number(source.expectedInHand), 0)
  return <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
    <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white sm:p-5"><p className="text-sm text-white/75">Expected in-hand income each month</p><p className="mt-1 whitespace-nowrap text-3xl font-bold">{formatCurrency(totalInHand)}</p><p className="mt-1 text-xs text-white/70">Use expected take-home pay for planning. Gross pay and deductions are kept for reference.</p></Card>
    <Button id="add-income-source" onClick={() => { setError(''); setAddOpen(true) }} className="w-full gap-2"><Plus size={16} /> Add salary or income</Button>
    <section className="space-y-2.5"><div className="flex items-end justify-between px-1"><div><h2 className="text-sm font-semibold">Money owed to me</h2><p className="text-xs text-gray-500">Track repayments as incoming money</p></div><Button size="sm" variant="outline" onClick={() => setAddOwedOpen(true)} className="gap-1"><Plus size={14} /> Add</Button></div>{owed.length > 0 ? <div className="space-y-2">{owed.map(item => <Card key={item.id} className="p-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><HandCoins size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-[11px] text-gray-500">{item.deadline ? `Due ${new Date(item.deadline).toLocaleDateString('en-IN')}` : 'No due date'}</p></div><div className="text-right"><p className="text-sm font-bold">{formatCurrency(item.remaining)}</p><Button size="sm" className="mt-1" onClick={() => { setReceiveOwed(item); setOwedAmount(String(item.remaining)); setOwedAccountId('') }}>Received</Button></div></div></Card>)}</div> : <Card className="p-4 text-center text-sm text-gray-500">Nothing owed to you right now.</Card>}</section>
    <div className="space-y-3">{sources.map(source => {
      const date = expectedDate(source)
      const received = source.occurrences.some(item => item.expectedDate.slice(0, 10) === date && item.status === 'RECEIVED')
      return <Card key={source.id} className="p-3.5 sm:p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5"><div className="min-w-0"><p className="truncate font-semibold">{source.name}</p><p className="truncate text-[11px] text-gray-500 sm:text-xs">{source.type.toLowerCase()} · day {source.payday} · {source.account?.name || 'No account selected'}</p></div><p className="whitespace-nowrap text-sm font-bold text-success min-[390px]:text-base">{formatCurrency(source.expectedInHand)}</p></div>
        {(source.grossAmount || source.defaultDeductions) && <p className="mt-2 truncate text-xs text-gray-500">Gross {formatCurrency(source.grossAmount || source.expectedInHand)} · deductions {formatCurrency(source.defaultDeductions || 0)}</p>}
      <div className="mt-3 flex gap-2 border-t border-border pt-3"><Button id={`receive-income-${source.id}`} size="sm" variant={received ? 'outline' : 'primary'} disabled={received} onClick={() => { setError(''); setReceive(source); setReceivedAmount(String(source.expectedInHand)) }} className="min-w-0 flex-1 gap-1 truncate"> <CheckCircle2 size={14} className="shrink-0" /> <span className="truncate">{received ? 'Received this month' : 'Record received'}</span> </Button><Button id={`edit-income-${source.id}`} size="sm" variant="outline" onClick={() => editSource(source)} aria-label={`Edit ${source.name}`} className="shrink-0"><Edit2 size={14} /></Button><Button id={`delete-income-${source.id}`} size="sm" variant="outline" onClick={() => removeSource(source)} aria-label={`Delete ${source.name}`} className="shrink-0 text-danger"><Trash2 size={14} /></Button></div>
      </Card>
    })}</div>
    {sources.length === 0 && <Card className="p-8 text-center text-gray-500"><Landmark className="mx-auto mb-2" /><p className="font-semibold">Start with your salary</p><p className="mt-1 text-sm">Your in-hand amount and payday make the payment plan useful.</p></Card>}
    <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add expected income"><form onSubmit={addSource} className="space-y-4 pb-4"><Input id="income-name" label="Name" value={form.name} onChange={f('name')} required /><Select id="income-type" label="Income type" value={form.type} onChange={f('type')}><option value="SALARY">Salary</option><option value="FREELANCE">Freelance</option><option value="RENTAL">Rental income</option><option value="INTEREST">Interest</option><option value="OTHER">Other</option></Select><Input id="income-payday" label="Expected payday (day of month)" type="number" min="1" max="31" value={form.payday} onChange={f('payday')} required /><div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input id="income-gross" label="Gross salary (optional)" type="number" min="0" step="0.01" value={form.grossAmount} onChange={f('grossAmount')} /><Input id="income-deductions" label="Usual deductions" type="number" min="0" step="0.01" value={form.defaultDeductions} onChange={f('defaultDeductions')} /></div><Input id="income-in-hand" label="Expected in-hand amount" type="number" min="0.01" step="0.01" value={form.expectedInHand} onChange={f('expectedInHand')} required /><Select id="income-account" label="Receiving account" value={form.accountId} onChange={f('accountId')}><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button id="save-income-source" type="submit" loading={loading}>Save income source</Button></form></Sheet>
    <Sheet open={Boolean(receive)} onClose={() => setReceive(null)} title="Record income received">{receive && <form onSubmit={receiveIncome} className="space-y-4 pb-4"><p className="rounded-xl bg-surface-offset p-3 text-sm">Expected {expectedDate(receive)} from <strong>{receive.name}</strong>.</p><Input id="actual-income-amount" label="Actual amount credited" type="number" min="0.01" step="0.01" value={receivedAmount} onChange={event => setReceivedAmount(event.target.value)} required />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button id="confirm-income-received" type="submit" loading={loading}>Record income received</Button></form>}</Sheet>
    <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title="Edit income source">{edit && <form onSubmit={saveEdit} className="space-y-4 pb-4"><Input id="edit-income-name" label="Name" value={form.name} onChange={f('name')} required /><Select id="edit-income-type" label="Income type" value={form.type} onChange={f('type')}><option value="SALARY">Salary</option><option value="FREELANCE">Freelance</option><option value="RENTAL">Rental income</option><option value="INTEREST">Interest</option><option value="OTHER">Other</option></Select><Input id="edit-income-payday" label="Expected payday" type="number" min="1" max="31" value={form.payday} onChange={f('payday')} required /><div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input id="edit-income-gross" label="Gross salary" type="number" min="0" step="0.01" value={form.grossAmount} onChange={f('grossAmount')} /><Input id="edit-income-deductions" label="Usual deductions" type="number" min="0" step="0.01" value={form.defaultDeductions} onChange={f('defaultDeductions')} /></div><Input id="edit-income-in-hand" label="Expected in-hand amount" type="number" min="0.01" step="0.01" value={form.expectedInHand} onChange={f('expectedInHand')} required /><Select id="edit-income-account" label="Receiving account" value={form.accountId} onChange={f('accountId')}><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button id="save-income-edit" type="submit" loading={loading}>Save changes</Button></form>}</Sheet>
    <Sheet open={addOwedOpen} onClose={() => setAddOwedOpen(false)} title="Add money owed to me"><form onSubmit={addOwed} className="space-y-4 pb-4"><Input label="Person or reason" value={owedForm.name} onChange={event => setOwedForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Arjun · dinner split" required /><Input label="Amount" type="number" min="0.01" step="0.01" value={owedForm.amount} onChange={event => setOwedForm(current => ({ ...current, amount: event.target.value }))} required /><DatePicker label="Expected by (optional)" value={owedForm.deadline} onChange={event => setOwedForm(current => ({ ...current, deadline: event.target.value }))} />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading}>Add to income</Button></form></Sheet>
    <Sheet open={Boolean(receiveOwed)} onClose={() => setReceiveOwed(null)} title="Record money received">{receiveOwed && <form onSubmit={recordOwedReceived} className="space-y-4 pb-4"><p className="rounded-xl bg-surface-offset p-3 text-sm">{receiveOwed.name} · {formatCurrency(receiveOwed.remaining)} remaining</p><Input label="Amount received" type="number" min="0.01" max={receiveOwed.remaining} step="0.01" value={owedAmount} onChange={event => setOwedAmount(event.target.value)} required /><Select label="Deposit into account" value={owedAccountId} onChange={event => setOwedAccountId(event.target.value)}><option value="">No account balance change</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading}>Record received</Button></form>}</Sheet>
  </div>
}
