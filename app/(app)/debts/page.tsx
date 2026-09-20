'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, DatePicker, Input, ProgressBar, Select, Sheet } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'
import { buildLoanSchedule } from '@/lib/loan-schedule'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string }
type DebtPayment = { id: string; amount: number; paidDate: string; accountId?: string }
type Debt = {
  id: string
  name: string
  direction: 'BORROWED' | 'LENT'
  type: 'PERSONAL' | 'LOAN' | 'CREDIT_LINE' | 'PAY_LATER'
  amount: number
  remaining: number
  interestRate: number
  isRecurring: boolean
  paymentDate?: number
  paymentAmount?: number
  totalInstallments?: number
  startDate?: string
  deadline?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  description?: string
  isActive: boolean
  payments: DebtPayment[]
}

type DebtFormState = {
  name: string
  direction: Debt['direction']
  type: Debt['type']
  amount: string
  remaining: string
  interestRate: string
  isRecurring: boolean
  paymentDate: string
  paymentAmount: string
  totalInstallments: string
  startDate: string
  deadline: string
  priority: Debt['priority']
  description: string
}

const emptyForm = (): DebtFormState => ({
  name: '', direction: 'BORROWED', type: 'LOAN', amount: '', remaining: '', interestRate: '0',
  isRecurring: true, paymentDate: '', paymentAmount: '', totalInstallments: '',
  startDate: new Date().toISOString().slice(0, 10), deadline: '', priority: 'MEDIUM', description: '',
})

const typeLabels: Record<Debt['type'], string> = {
  PERSONAL: 'Personal debt', LOAN: 'Loan / EMI', CREDIT_LINE: 'Credit line', PAY_LATER: 'Personal pay later',
}

function LoanSchedule({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const schedule = buildLoanSchedule(debt.amount, debt.interestRate || 0, debt.paymentAmount!, debt.totalInstallments!, debt.startDate!, debt.paymentDate)
  const payments = [...debt.payments].sort((a, b) => new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime())
  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  return <Sheet open onClose={onClose} title={`${debt.name} installments`}>
    <div className="space-y-4 pb-4">
      <Card className="grid grid-cols-3 gap-1.5 p-3 text-center sm:gap-2 sm:p-4">
        <div className="min-w-0"><p className="text-[10px] text-gray-500">Original</p><p className="truncate text-xs font-bold min-[390px]:text-sm">{formatCurrency(debt.amount)}</p></div>
        <div className="min-w-0"><p className="text-[10px] text-gray-500">Paid</p><p className="truncate text-xs font-bold text-success min-[390px]:text-sm">{formatCurrency(paidTotal)}</p></div>
        <div className="min-w-0"><p className="text-[10px] text-gray-500">Remaining</p><p className="truncate text-xs font-bold text-danger min-[390px]:text-sm">{formatCurrency(debt.remaining)}</p></div>
      </Card>
      <p className="text-xs text-gray-500">Estimated principal and interest split. Recorded payments show your actual progress.</p>
      <Card className="divide-y divide-border overflow-hidden dark:divide-gray-800">
        {schedule.map((item, index) => {
          const payment = payments[index]
          return <div key={item.number} className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-2 p-3 text-xs">
            <span className="font-bold text-primary">{item.number}</span>
            <div className="min-w-0"><p className="font-semibold">{item.dueDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p><p className="truncate text-[10px] text-gray-500">Principal {formatCurrency(item.principal)} · Interest {formatCurrency(item.interest)}</p></div>
            <div className="shrink-0 whitespace-nowrap text-right"><p className="font-bold">{formatCurrency(item.emi)}</p><p className={payment ? 'text-[10px] text-success' : 'text-[10px] text-gray-400'}>{payment ? `Paid ${formatCurrency(payment.amount)}` : `Bal. ${formatCurrency(item.closing)}`}</p></div>
          </div>
        })}
      </Card>
    </div>
  </Sheet>
}

function DebtFields({ form, setForm, editing }: { form: DebtFormState; setForm: React.Dispatch<React.SetStateAction<DebtFormState>>; editing: boolean }) {
  const set = (key: keyof DebtFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value
    setForm(current => ({ ...current, [key]: value }))
  }
  return <>
    <Select label="This money is" value={form.direction} onChange={set('direction')} disabled={editing}>
      <option value="BORROWED">Money I owe</option><option value="LENT">Money I lent to someone</option>
    </Select>
    <Select label="Type" value={form.type} onChange={set('type')}>
      {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </Select>
    <Input label={form.direction === 'LENT' ? 'Person or purpose' : 'Loan or lender name'} value={form.name} onChange={set('name')} required />
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      <Input label="Original amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
      {editing ? <Input label="Remaining" type="number" min="0" step="0.01" value={form.remaining} onChange={set('remaining')} required /> : <Input label="Interest % yearly" type="number" min="0" step="0.01" value={form.interestRate} onChange={set('interestRate')} />}
    </div>
    {editing && <Input label="Interest % yearly" type="number" min="0" step="0.01" value={form.interestRate} onChange={set('interestRate')} />}
    <label className="flex items-center gap-2 rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800"><input type="checkbox" checked={form.isRecurring} onChange={set('isRecurring')} /> Paid in monthly installments</label>
    {form.isRecurring ? <>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Monthly installment" type="number" min="0.01" step="0.01" value={form.paymentAmount} onChange={set('paymentAmount')} required /><Input label="Due day" type="number" min="1" max="31" value={form.paymentDate} onChange={set('paymentDate')} required /></div>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Total installments" type="number" min="1" value={form.totalInstallments} onChange={set('totalInstallments')} placeholder="Optional" /><DatePicker label="First installment" value={form.startDate} onChange={set('startDate')} /></div>
    </> : <DatePicker label="Target repayment date" value={form.deadline} onChange={set('deadline')} />}
    <Select label="Priority" value={form.priority} onChange={set('priority')}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></Select>
    <Input label="Notes (optional)" value={form.description} onChange={set('description')} />
  </>
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filter, setFilter] = useState<'ALL' | Debt['direction']>('ALL')
  const [form, setForm] = useState<DebtFormState>(emptyForm)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)
  const [schedule, setSchedule] = useState<Debt | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [debtResponse, accountResponse] = await Promise.all([fetch('/api/debts'), fetch('/api/accounts')])
      setDebts(await debtResponse.json()); setAccounts(await accountResponse.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const active = debts.filter(debt => debt.isActive && Number(debt.remaining) > 0)
  const visible = active.filter(debt => filter === 'ALL' || debt.direction === filter)
  const iOwe = active.filter(debt => debt.direction === 'BORROWED').reduce((sum, debt) => sum + Number(debt.remaining), 0)
  const owedToMe = active.filter(debt => debt.direction === 'LENT').reduce((sum, debt) => sum + Number(debt.remaining), 0)
  const monthly = active.filter(debt => debt.direction === 'BORROWED' && debt.isRecurring).reduce((sum, debt) => sum + Number(debt.paymentAmount || 0), 0)

  const payload = (state: DebtFormState, includeRemaining: boolean) => ({
    name: state.name, direction: state.direction, type: state.type,
    amount: Number(state.amount), ...(includeRemaining && { remaining: Number(state.remaining) }),
    interestRate: Number(state.interestRate || 0), isRecurring: state.isRecurring,
    paymentDate: state.isRecurring && state.paymentDate ? Number(state.paymentDate) : null,
    paymentAmount: state.isRecurring && state.paymentAmount ? Number(state.paymentAmount) : null,
    totalInstallments: state.isRecurring && state.totalInstallments ? Number(state.totalInstallments) : null,
    startDate: state.isRecurring && state.startDate ? state.startDate : null,
    deadline: !state.isRecurring && state.deadline ? state.deadline : null,
    priority: state.priority, description: state.description || null,
  })

  async function save(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch(editing ? `/api/debts/${editing.id}` : '/api/debts', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(form, Boolean(editing))),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save')
      setAddOpen(false); setEditing(null); setForm(emptyForm()); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save') } finally { setLoading(false) }
  }

  function edit(debt: Debt) {
    setError(''); setEditing(debt); setForm({
      name: debt.name, direction: debt.direction, type: debt.type, amount: String(debt.amount), remaining: String(debt.remaining),
      interestRate: String(debt.interestRate || 0), isRecurring: debt.isRecurring,
      paymentDate: debt.paymentDate ? String(debt.paymentDate) : '', paymentAmount: debt.paymentAmount ? String(debt.paymentAmount) : '',
      totalInstallments: debt.totalInstallments ? String(debt.totalInstallments) : '', startDate: debt.startDate?.slice(0, 10) || '',
      deadline: debt.deadline?.slice(0, 10) || '', priority: debt.priority, description: debt.description || '',
    })
  }

  async function remove(debt: Debt) {
    if (!confirm(`Delete ${debt.name}?`)) return
    await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' }); load()
  }

  async function recordPayment(event: React.FormEvent) {
    event.preventDefault(); if (!paying) return; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/debts/${paying.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount), paidDate, accountId: accountId || undefined }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record payment')
      setPaying(null); setAmount(''); setAccountId(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment') } finally { setLoading(false) }
  }

  return <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
    <Card className="bg-gradient-to-br from-primary to-primary-hover p-4 text-white sm:p-5">
      <p className="text-sm text-white/75">Total I owe</p><p className="mt-1 whitespace-nowrap text-3xl font-bold">{formatCurrency(iOwe)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-center"><div className="min-w-0"><p className="truncate text-[10px] text-white/70">Monthly installments</p><p className="truncate text-sm font-bold min-[390px]:text-base">{formatCurrency(monthly)}</p></div><div className="min-w-0"><p className="truncate text-[10px] text-white/70">Owed to me</p><p className="truncate text-sm font-bold min-[390px]:text-base">{formatCurrency(owedToMe)}</p></div></div>
    </Card>
    <Button onClick={() => { setError(''); setForm(emptyForm()); setAddOpen(true) }} className="w-full gap-2"><Plus size={16} /> Add loan, debt, or lending</Button>
    <div className="grid grid-cols-3 gap-2">
      {([['ALL', 'All'], ['BORROWED', 'I owe'], ['LENT', 'Owed to me']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn('rounded-xl px-3 py-2 text-xs font-semibold', filter === value ? 'bg-primary text-white' : 'bg-surface-offset text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>{label}</button>)}
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {loading && debts.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Loading loans…</p> : visible.length === 0 ? <Card className="p-8 text-center text-gray-500"><Landmark className="mx-auto mb-2" /><p>No records here yet.</p></Card> : <div className="space-y-3">
      {visible.map(debt => {
        const progress = debt.amount > 0 ? Math.min(100, Math.max(0, ((debt.amount - debt.remaining) / debt.amount) * 100)) : 0
        const payments = [...debt.payments].sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime())
        const canShowSchedule = debt.type === 'LOAN' && debt.isRecurring && debt.paymentAmount && debt.totalInstallments && debt.startDate
        return <Card key={debt.id} className="p-3.5 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5"><div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate font-semibold">{debt.name}</p><Badge className={cn('shrink-0 text-[10px]', debt.direction === 'LENT' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>{debt.direction === 'LENT' ? 'Owed to me' : typeLabels[debt.type]}</Badge></div><p className="mt-1 truncate text-[11px] text-gray-500 sm:text-xs">{debt.isRecurring && debt.paymentAmount ? `${formatCurrency(debt.paymentAmount)} monthly${debt.paymentDate ? ` · day ${debt.paymentDate}` : ''}` : debt.deadline ? `Target ${new Date(debt.deadline).toLocaleDateString('en-IN')}` : 'No repayment date set'}</p></div><div className="shrink-0 whitespace-nowrap text-right"><p className="text-sm font-bold min-[390px]:text-base">{formatCurrency(debt.remaining)}</p><p className="text-[10px] text-gray-500">remaining</p></div></div>
          <div className="mt-3"><ProgressBar value={progress} max={100} /><div className="mt-1 flex justify-between text-[10px] text-gray-500"><span>{Math.round(progress)}% complete</span><span>{payments.length} payments recorded</span></div></div>
          {debt.description && <p className="mt-2 text-xs text-gray-500">{debt.description}</p>}
          {canShowSchedule && <Button size="sm" variant="outline" onClick={() => setSchedule(debt)} className="mt-3 gap-1"><CalendarDays size={13} /> Installment breakdown</Button>}
          {payments.length > 0 && <details className="mt-3 rounded-xl bg-surface-offset px-3 py-2 text-xs dark:bg-gray-800"><summary className="cursor-pointer font-semibold">Payment history</summary><div className="mt-2 divide-y divide-border dark:divide-gray-700">{payments.map(payment => <div key={payment.id} className="flex justify-between py-2"><span>{new Date(payment.paidDate).toLocaleDateString('en-IN')}</span><span className="font-semibold">{formatCurrency(payment.amount)}</span></div>)}</div></details>}
          <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3 dark:border-gray-800"><Button size="sm" variant="outline" onClick={() => edit(debt)}><Pencil size={13} /></Button><Button size="sm" variant="outline" onClick={() => remove(debt)} className="text-danger"><Trash2 size={13} /></Button><Button size="sm" onClick={() => { setError(''); setPaying(debt); setAmount(String(Math.min(Number(debt.paymentAmount || debt.remaining), Number(debt.remaining)))); setPaidDate(new Date().toISOString().slice(0, 10)); setAccountId('') }} className="gap-1"><CheckCircle2 size={13} /> {debt.direction === 'LENT' ? 'Receive' : 'Pay'}</Button></div>
        </Card>
      })}
    </div>}

    <Sheet open={addOpen || Boolean(editing)} onClose={() => { setAddOpen(false); setEditing(null) }} title={editing ? 'Edit loan or debt' : 'Add loan, debt, or lending'}><form onSubmit={save} className="space-y-4 pb-5"><DebtFields form={form} setForm={setForm} editing={Boolean(editing)} />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading}>{editing ? 'Save changes' : 'Add record'}</Button></form></Sheet>
    <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} title={paying?.direction === 'LENT' ? 'Record money received' : 'Record payment'}>{paying && <form onSubmit={recordPayment} className="space-y-4 pb-5"><p className="rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800">{paying.name} · {formatCurrency(paying.remaining)} remaining</p><Input label={paying.direction === 'LENT' ? 'Amount received' : 'Amount paid'} type="number" min="0.01" max={paying.remaining} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /><DatePicker label="Payment date" value={paidDate} onChange={event => setPaidDate(event.target.value)} /><Select label={paying.direction === 'LENT' ? 'Credit to account' : 'Pay from account'} value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">No account balance change</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={loading}>Record payment</Button></form>}</Sheet>
    {schedule && <LoanSchedule debt={schedule} onClose={() => setSchedule(null)} />}
  </div>
}
