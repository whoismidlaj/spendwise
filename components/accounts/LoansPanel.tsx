'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Landmark, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, DatePicker, EmptyState, FormSection, InlineError, Input, LoadingState, ProgressBar, Select, Sheet, SummaryCard } from '@/components/ui'
import { api, errorMessage } from '@/lib/client-api'
import { formatCurrency } from '@/lib/currency'
import { resolveLoanSchedule, paymentsByInstallment } from '@/lib/loan-schedule'
import { summarizeLoan } from '@/lib/loan-summary'
import { parseSchedule, type ScheduleRow as Row } from '@/lib/schedule-import'
import type { Account } from './BankAccountsPanel'

type DebtPayment = { id: string; amount: number; principalAmount?: number | null; interestAmount?: number | null; installmentNumber?: number | null; paidDate: string; accountId?: string | null }
type Installment = { number?: number; dueDate: string; amount: number; principal?: number; interest?: number }
type Debt = {
  id: string; name: string; direction: 'BORROWED' | 'LENT'; type: 'PERSONAL' | 'LOAN' | 'CREDIT_LINE' | 'PAY_LATER'
  amount: number; remaining: number; interestRate: number; isRecurring: boolean; paymentDate?: number | null; paymentAmount?: number | null
  totalInstallments?: number | null; startDate?: string | null; totalRepaymentAmount?: number | null; totalInterestAmount?: number | null
  installmentSchedule?: Installment[] | null; deadline?: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'; description?: string | null
  isActive: boolean; payments: DebtPayment[]
}

const typeLabels: Record<Debt['type'], string> = { PERSONAL: 'Personal debt', LOAN: 'Loan / EMI', CREDIT_LINE: 'Credit line', PAY_LATER: 'Pay later' }
const today = () => new Date().toISOString().slice(0, 10)
const shortDate = (value: string | Date) => new Date(value).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

type Mode = 'FIXED' | 'LENDER' | 'ONE_TIME'

function LoanForm({ initial, onSuccess }: { initial?: Debt; onSuccess: () => void }) {
  const initialMode: Mode = initial ? (initial.installmentSchedule?.length ? 'LENDER' : initial.isRecurring ? 'FIXED' : 'ONE_TIME') : 'FIXED'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [form, setForm] = useState({
    name: initial?.name ?? '', type: (initial?.type ?? 'LOAN') as Debt['type'], amount: initial ? String(initial.amount) : '', remaining: initial ? String(initial.remaining) : '',
    interestRate: String(initial?.interestRate ?? 0), paymentAmount: initial?.paymentAmount ? String(initial.paymentAmount) : '', totalInstallments: initial?.totalInstallments ? String(initial.totalInstallments) : '',
    startDate: initial?.startDate?.slice(0, 10) ?? today(), deadline: initial?.deadline?.slice(0, 10) ?? '', paidInstallments: '',
    totalInterestAmount: initial?.totalInterestAmount != null ? String(initial.totalInterestAmount) : '', totalRepaymentAmount: initial?.totalRepaymentAmount != null ? String(initial.totalRepaymentAmount) : '',
    priority: initial?.priority ?? 'MEDIUM', description: initial?.description ?? '',
  })
  const [rows, setRows] = useState<Row[]>(initial?.installmentSchedule?.map(item => ({ dueDate: item.dueDate.slice(0, 10), amount: String(item.amount), principal: item.principal != null ? String(item.principal) : '', interest: item.interest != null ? String(item.interest) : '' })) ?? [])
  const [pasted, setPasted] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }))
  const num = (value: string) => value === '' ? undefined : Number(value)

  function applyPaste() {
    const parsed = parseSchedule(pasted)
    if (!parsed.length) { setError('No schedule rows found. Use one line per installment: date, amount, principal, interest.'); return }
    setError(''); setRows(parsed); setPasted('')
  }
  const updateRow = (index: number, key: keyof Row, value: string) => setRows(current => current.map((row, position) => position === index ? { ...row, [key]: value } : row))

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = {
        name: form.name, direction: 'BORROWED', type: form.type, amount: Number(form.amount), interestRate: Number(form.interestRate || 0),
        priority: form.priority, description: form.description || null,
        isRecurring: mode !== 'ONE_TIME',
        paymentAmount: null, paymentDate: null, totalInstallments: null, startDate: null, deadline: null, installmentSchedule: null, totalInterestAmount: null, totalRepaymentAmount: null,
      }
      if (mode === 'FIXED') {
        const first = new Date(`${form.startDate}T12:00:00`)
        Object.assign(body, { paymentAmount: Number(form.paymentAmount), totalInstallments: Number(form.totalInstallments), startDate: form.startDate, paymentDate: first.getDate() })
        if (!initial && form.paidInstallments) body.paidInstallments = Number(form.paidInstallments)
      } else if (mode === 'LENDER') {
        if (!rows.length) throw new Error('Add the installment schedule from your lender')
        const schedule = rows.map(row => ({ dueDate: row.dueDate, amount: Number(row.amount), principal: num(row.principal), interest: num(row.interest) }))
        if (schedule.some(item => !item.dueDate || !Number.isFinite(item.amount))) throw new Error('Every installment needs a due date and an amount')
        Object.assign(body, {
          installmentSchedule: schedule, totalInstallments: schedule.length, startDate: schedule[0].dueDate, paymentDate: new Date(`${schedule[0].dueDate}T12:00:00`).getDate(),
          paymentAmount: schedule[0].amount, totalInterestAmount: num(form.totalInterestAmount) ?? null, totalRepaymentAmount: num(form.totalRepaymentAmount) ?? null,
        })
        if (!initial && form.paidInstallments) body.paidInstallments = Number(form.paidInstallments)
      } else body.deadline = form.deadline || null
      if (form.remaining !== '' && (initial || mode === 'LENDER')) body.remaining = Number(form.remaining)
      await api(initial ? `/api/debts/${initial.id}` : '/api/debts', { method: initial ? 'PATCH' : 'POST', body })
      onSuccess()
    } catch (cause) { setError(errorMessage(cause, 'Unable to save')) } finally { setSaving(false) }
  }

  const modes: Array<[Mode, string]> = [['FIXED', 'Fixed EMI'], ['LENDER', 'Lender schedule'], ['ONE_TIME', 'One-time debt']]
  return (
    <form onSubmit={submit} className="space-y-4 pb-5">
      <div role="radiogroup" aria-label="How is it repaid?" className="grid grid-cols-3 overflow-hidden rounded-xl border border-border dark:border-gray-700">
        {modes.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)} className={`min-h-[44px] px-1 text-xs font-medium ${mode === value ? 'bg-primary text-white' : 'text-gray-500'}`}>{label}</button>)}
      </div>
      <p className="text-xs text-gray-500">{mode === 'FIXED' ? 'The app generates the schedule from the principal, interest rate and EMI.' : mode === 'LENDER' ? 'Enter the installments exactly as your lender lists them, including a different first or last installment.' : 'A single repayment by a target date.'}</p>
      <Select label="Type" value={form.type} onChange={field('type')}>{(['LOAN', 'PERSONAL', 'CREDIT_LINE'] as const).map(value => <option key={value} value={value}>{typeLabels[value]}</option>)}{form.type === 'PAY_LATER' && <option value="PAY_LATER">{typeLabels.PAY_LATER}</option>}</Select>
      <Input label="Loan or lender name" value={form.name} onChange={field('name')} required />
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Input label="Original principal" type="number" min="0.01" step="0.01" value={form.amount} onChange={field('amount')} required />
        <Input label="Interest % yearly" type="number" min="0" step="0.01" value={form.interestRate} onChange={field('interestRate')} />
      </div>
      {(initial || mode === 'LENDER') && <Input label="Principal outstanding now" type="number" min="0" step="0.01" value={form.remaining} onChange={field('remaining')} required={Boolean(initial)} placeholder={mode === 'LENDER' ? 'Defaults to original principal' : undefined} />}
      {mode === 'FIXED' && <>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Regular EMI" type="number" min="0.01" step="0.01" value={form.paymentAmount} onChange={field('paymentAmount')} required /><Input label="Term (months)" type="number" min="1" value={form.totalInstallments} onChange={field('totalInstallments')} required /></div>
        <DatePicker label="First installment date" value={form.startDate} onChange={field('startDate')} required />
      </>}
      {mode === 'LENDER' && <FormSection title="Official totals" description="Optional. Use the totals printed by your lender when they differ from the sum of the rows.">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Total interest" type="number" min="0" step="0.01" value={form.totalInterestAmount} onChange={field('totalInterestAmount')} /><Input label="Total repayment" type="number" min="0" step="0.01" value={form.totalRepaymentAmount} onChange={field('totalRepaymentAmount')} /></div>
      </FormSection>}
      {mode === 'LENDER' && <FormSection title={`Installments (${rows.length})`}>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">Paste from a spreadsheet
          <textarea value={pasted} onChange={event => setPasted(event.target.value)} rows={3} placeholder={'2026-10-05, 6487, 2969, 3518\n2026-11-05, 6421, 3098, 3323'} className="rounded-xl border border-border bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800" />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={applyPaste} disabled={!pasted.trim()}>Replace rows with pasted schedule</Button>
        {rows.length > 0 && <div className="max-h-72 space-y-2 overflow-y-auto">{rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1.6rem_minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_2.75rem] items-end gap-1 text-xs">
            <span className="pb-3 font-bold text-primary">{index + 1}</span>
            <Input label="Due" aria-label={`Installment ${index + 1} due date`} type="date" value={row.dueDate} onChange={event => updateRow(index, 'dueDate', event.target.value)} className="px-1.5 text-xs" />
            <Input label="Amount" aria-label={`Installment ${index + 1} amount`} type="number" step="0.01" value={row.amount} onChange={event => updateRow(index, 'amount', event.target.value)} className="px-1.5 text-xs" />
            <Input label="Principal" aria-label={`Installment ${index + 1} principal`} type="number" step="0.01" value={row.principal} onChange={event => updateRow(index, 'principal', event.target.value)} className="px-1.5 text-xs" />
            <Input label="Interest" aria-label={`Installment ${index + 1} interest`} type="number" step="0.01" value={row.interest} onChange={event => updateRow(index, 'interest', event.target.value)} className="px-1.5 text-xs" />
            <button type="button" aria-label={`Remove installment ${index + 1}`} onClick={() => setRows(current => current.filter((_, position) => position !== index))} className="flex h-11 w-11 items-center justify-center rounded-lg text-danger"><Trash2 size={14} aria-hidden /></button>
          </div>))}</div>}
        <Button type="button" size="sm" variant="outline" onClick={() => setRows(current => [...current, { dueDate: '', amount: '', principal: '', interest: '' }])} className="gap-1"><Plus size={13} aria-hidden /> Add installment</Button>
      </FormSection>}
      {mode === 'ONE_TIME' && <DatePicker label="Target repayment date" value={form.deadline} onChange={field('deadline')} />}
      {!initial && mode !== 'ONE_TIME' && <Input label="Installments already paid" type="number" min="0" step="1" value={form.paidInstallments} onChange={field('paidInstallments')} placeholder="0" />}
      {!initial && mode !== 'ONE_TIME' && <p className="-mt-2 text-xs text-gray-500">For a loan that started earlier: these installments are recorded as paid, with no account balance change.</p>}
      <Select label="Priority" value={form.priority} onChange={field('priority')}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></Select>
      <Input label="Notes (optional)" value={form.description} onChange={field('description')} />
      <InlineError message={error} />
      <Button type="submit" size="lg" loading={saving}>{initial ? 'Save changes' : 'Add loan or debt'}</Button>
    </form>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0"><dt className="text-[10px] text-gray-500">{label}</dt><dd className={`truncate text-sm font-bold tabular-nums ${tone ?? ''}`}>{value}</dd></div>
}

function LoanDetail({ debt, accounts, onClose, onChanged }: { debt: Debt; accounts: Account[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const summary = useMemo(() => summarizeLoan(debt), [debt])
  const schedule = useMemo(() => resolveLoanSchedule({ ...debt, startDate: debt.startDate ? new Date(debt.startDate) : null }), [debt])
  const matched = useMemo(() => paymentsByInstallment(schedule, debt.payments.map(item => ({ ...item, paidDate: new Date(item.paidDate) }))), [schedule, debt.payments])
  const [paying, setPaying] = useState<{ number?: number; amount: number } | null>(null)
  const [undoing, setUndoing] = useState<DebtPayment | null>(null)
  const [accountId, setAccountId] = useState('')
  const [paidDate, setPaidDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [through, setThrough] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>, done?: () => void) {
    setBusy(true); setError('')
    try { await action(); done?.(); await onChanged() } catch (cause) { setError(errorMessage(cause, 'Unable to update loan')) } finally { setBusy(false) }
  }
  const payments = [...debt.payments].sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime())

  return (
    <Sheet open onClose={onClose} title={debt.name}>
      <div className="space-y-4 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/10 text-primary">{typeLabels[debt.type]}</Badge>
          <Badge className={debt.isActive ? 'bg-success/10 text-success' : 'bg-surface-offset text-gray-500 dark:bg-gray-800'}>{debt.isActive ? 'Active' : 'Completed'}</Badge>
          {summary.scheduleSource !== 'none' && <Badge className="bg-surface-offset text-gray-600 dark:bg-gray-800 dark:text-gray-300">{summary.scheduleSource === 'lender' ? 'Lender schedule' : 'Generated schedule'}</Badge>}
        </div>
        <Card className="p-3"><dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="Original principal" value={formatCurrency(summary.originalPrincipal)} />
          <Stat label="Principal outstanding" value={formatCurrency(summary.principalOutstanding)} tone="text-danger" />
          <Stat label="Total paid" value={formatCurrency(summary.totalPaid)} tone="text-success" />
          <Stat label="Principal paid" value={formatCurrency(summary.principalPaid)} />
          <Stat label="Interest paid" value={formatCurrency(summary.interestPaid)} />
          <Stat label="Future principal" value={formatCurrency(summary.futurePrincipal)} />
          <Stat label="Future interest" value={formatCurrency(summary.futureInterest)} />
          <Stat label="Future payable" value={formatCurrency(summary.futurePayable)} tone="text-danger" />
        </dl></Card>
        {debt.totalRepaymentAmount != null && <p className="text-xs text-gray-500">Lender's official totals: {formatCurrency(debt.totalRepaymentAmount)} repayment, {formatCurrency(debt.totalInterestAmount ?? 0)} interest.</p>}
        <InlineError message={error} />

        {schedule.length > 0 ? <>
          {debt.isActive && <FormSection title="Bring up to date" description="Mark every unpaid installment due up to a date as paid, without changing any account balance.">
            <div className="flex items-end gap-2"><div className="flex-1"><DatePicker label="Paid through" value={through} onChange={event => setThrough(event.target.value)} required /></div><Button variant="outline" loading={busy} onClick={() => run(() => api(`/api/debts/${debt.id}/catch-up`, { method: 'POST', body: { through } }))}>Mark paid</Button></div>
          </FormSection>}
          <p className="px-1 text-sm font-semibold">Installments · {summary.paidInstallments} of {summary.totalInstallments} paid</p>
          <Card className="overflow-hidden"><ul className="divide-y divide-border dark:divide-gray-800">
            {schedule.map(item => {
              const payment = matched.get(item.number) as (DebtPayment & { paidDate: Date }) | undefined
              return <li key={item.number} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 p-3 text-xs">
                <span className="font-bold text-primary">{item.number}</span>
                <div className="min-w-0"><p className="font-semibold">{shortDate(item.dueDate)}</p><p className="truncate text-[10px] text-gray-500">Principal {formatCurrency(item.principal)} · Interest {formatCurrency(item.interest)}</p></div>
                <div className="shrink-0 text-right"><p className="font-bold tabular-nums">{formatCurrency(item.amount)}</p>
                  {payment ? <><p className="text-[10px] text-success">Paid {formatCurrency(payment.amount)}</p><Button size="sm" variant="outline" aria-label={`Undo installment ${item.number}`} className="mt-1 min-h-11 px-2 text-[10px]" onClick={() => setUndoing(debt.payments.find(entry => entry.id === payment.id)!)}><Undo2 size={11} aria-hidden /> Undo</Button></>
                    : debt.isActive ? <Button size="sm" variant="outline" aria-label={`Mark installment ${item.number} paid`} className="mt-1 min-h-11 px-2 text-[10px]" onClick={() => { setPaying({ number: item.number, amount: item.amount }); setAccountId(''); setPaidDate(today()) }}>Mark paid</Button> : <p className="text-[10px] text-gray-400">Not paid</p>}</div>
              </li>
            })}
          </ul></Card>
        </> : <>
          {debt.isActive && <Button onClick={() => { setPaying({ amount: Math.min(Number(debt.paymentAmount || debt.remaining), Number(debt.remaining)) }); setAmount(String(Math.min(Number(debt.paymentAmount || debt.remaining), Number(debt.remaining)))); setAccountId(''); setPaidDate(today()) }} className="w-full gap-1"><CheckCircle2 size={14} aria-hidden /> Record payment</Button>}
          {payments.length > 0 ? <Card className="overflow-hidden"><ul className="divide-y divide-border dark:divide-gray-800">{payments.map(payment => <li key={payment.id} className="flex items-center justify-between gap-2 p-3 text-xs"><span>{new Date(payment.paidDate).toLocaleDateString('en-IN')}</span><span className="font-semibold tabular-nums">{formatCurrency(payment.amount)}</span><Button size="sm" variant="outline" aria-label={`Undo payment of ${formatCurrency(payment.amount)}`} className="min-h-11 px-2 text-[10px]" onClick={() => setUndoing(payment)}><Undo2 size={11} aria-hidden /> Undo</Button></li>)}</ul></Card> : <p className="text-sm text-gray-500">No payments recorded yet.</p>}
        </>}
      </div>

      <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} title={paying?.number ? `Pay installment ${paying.number}` : 'Record payment'}>
        {paying && <form className="space-y-4 pb-4" onSubmit={event => { event.preventDefault(); run(() => api(`/api/debts/${debt.id}/pay`, { method: 'POST', body: { amount: paying.number ? paying.amount : Number(amount), paidDate, accountId: accountId || undefined, ...(paying.number ? { installmentNumber: paying.number } : {}) } }), () => setPaying(null)) }}>
          {paying.number ? <p className="rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800">Scheduled payment of {formatCurrency(paying.amount)} (principal and interest as per the schedule).</p> : <Input label="Amount paid" type="number" min="0.01" max={debt.remaining} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required />}
          <DatePicker label="Payment date" value={paidDate} onChange={event => setPaidDate(event.target.value)} required />
          <Select label="Pay from account" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">No account balance change</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
          <InlineError message={error} />
          <Button type="submit" loading={busy}>Record payment</Button>
        </form>}
      </Sheet>
      <ConfirmDialog open={Boolean(undoing)} title="Mark as unpaid" loading={busy} error={error} confirmLabel="Mark unpaid" message="The payment is removed, the principal outstanding is restored and any linked account balance is returned." onConfirm={() => undoing && run(() => api(`/api/debts/${debt.id}/pay`, { method: 'DELETE', body: { paymentId: undoing.id } }), () => setUndoing(null))} onCancel={() => setUndoing(null)} />
    </Sheet>
  )
}

export function LoansPanel() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filter, setFilter] = useState<'active' | 'completed'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<{ edit?: Debt } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Debt | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, accountList] = await Promise.all([api<Debt[]>('/api/debts'), api<Account[]>('/api/accounts')])
      setDebts(list.filter(item => item.direction === 'BORROWED')); setAccounts(accountList); setError('')
    } catch (cause) { setError(errorMessage(cause, 'Unable to load loans')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try { await api(`/api/debts/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); await load() } catch (cause) { setError(errorMessage(cause, 'Unable to delete')); setDeleting(null) } finally { setBusy(false) }
  }

  const isActive = (debt: Debt) => debt.isActive && Number(debt.remaining) > 0
  const active = debts.filter(isActive)
  const visible = debts.filter(debt => isActive(debt) === (filter === 'active'))
  const owed = active.reduce((sum, debt) => sum + Number(debt.remaining), 0)
  const monthly = active.filter(debt => debt.isRecurring).reduce((sum, debt) => sum + Number(debt.paymentAmount || 0), 0)
  const detail = debts.find(debt => debt.id === detailId) ?? null

  return (
    <div className="space-y-3">
      <SummaryCard label="Principal outstanding" value={formatCurrency(owed)} detail={`${active.length} active loan${active.length === 1 ? '' : 's'} · ${formatCurrency(monthly)} in regular monthly installments`} />
      <Button onClick={() => setSheet({})} className="w-full gap-2"><Plus size={16} aria-hidden /> Add loan or debt</Button>
      <div className="flex gap-2" role="group" aria-label="Filter loans">
        {(['active', 'completed'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'primary' : 'outline'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'active' ? 'Active' : 'Completed'}</Button>)}
      </div>
      <InlineError message={error} />
      {loading ? <LoadingState label="Loading loans…" /> : visible.length === 0 ? <EmptyState icon={<Landmark />} title={filter === 'active' ? 'No active loans or debts' : 'No completed loans yet'} description={filter === 'active' ? 'Add a loan to track its schedule, principal and interest.' : 'Fully repaid loans keep their history here.'} /> : (
        <div className="space-y-3">{visible.map(debt => {
          const summary = summarizeLoan(debt)
          const progress = debt.amount > 0 ? Math.min(100, Math.max(0, ((debt.amount - debt.remaining) / debt.amount) * 100)) : 0
          return (
            <Card key={debt.id} className="p-3.5 sm:p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5"><p className="truncate font-semibold">{debt.name}</p><Badge className="shrink-0 bg-primary/10 text-[10px] text-primary">{typeLabels[debt.type]}</Badge></div>
                  <p className="mt-1 truncate text-[11px] text-gray-500 sm:text-xs">{summary.totalInstallments ? `${summary.paidInstallments} of ${summary.totalInstallments} installments paid` : debt.deadline ? `Target ${new Date(debt.deadline).toLocaleDateString('en-IN')}` : 'No repayment date set'}{summary.scheduleSource === 'lender' ? ' · lender schedule' : ''}</p>
                </div>
                <div className="shrink-0 whitespace-nowrap text-right"><p className="text-sm font-bold tabular-nums min-[390px]:text-base">{formatCurrency(debt.remaining)}</p><p className="text-[10px] text-gray-500">principal left</p></div>
              </div>
              <div className="mt-3"><ProgressBar value={progress} max={100} /><div className="mt-1 flex justify-between text-[10px] text-gray-500"><span>{Math.round(progress)}% of principal repaid</span><span>{debt.payments.length} payment{debt.payments.length === 1 ? '' : 's'}</span></div></div>
              {summary.totalInstallments > 0 && <p className="mt-2 text-[11px] text-gray-500">Future payable {formatCurrency(summary.futurePayable)} · {formatCurrency(summary.futureInterest)} of it interest</p>}
              {debt.type === 'PAY_LATER' && <p className="mt-2 text-[11px] text-gray-500">Pay-later accounts are managed under Cards &amp; pay later.</p>}
              <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3 dark:border-gray-800">
                <Button size="sm" variant="outline" onClick={() => setSheet({ edit: debt })} aria-label={`Edit ${debt.name}`}><Pencil size={13} aria-hidden /></Button>
                <Button size="sm" variant="outline" onClick={() => setDeleting(debt)} aria-label={`Delete ${debt.name}`} className="text-danger"><Trash2 size={13} aria-hidden /></Button>
                <Button size="sm" onClick={() => setDetailId(debt.id)} className="gap-1"><CalendarDays size={13} aria-hidden /> Details</Button>
              </div>
            </Card>
          )
        })}</div>
      )}
      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.edit ? 'Edit loan or debt' : 'Add loan or debt'}>{sheet && <LoanForm initial={sheet.edit} onSuccess={() => { setSheet(null); load() }} />}</Sheet>
      {detail && <LoanDetail debt={detail} accounts={accounts} onClose={() => setDetailId(null)} onChanged={load} />}
      <ConfirmDialog open={Boolean(deleting)} title="Delete loan or debt" destructive confirmLabel="Delete" loading={busy} message={`Delete ${deleting?.name ?? 'this record'} and its payment history? This cannot be undone; download a backup first if unsure.`} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
