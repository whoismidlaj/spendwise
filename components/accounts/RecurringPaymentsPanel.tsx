'use client'
import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, CalendarClock, Edit2, History, Pause, Play, Plus } from 'lucide-react'
import { Badge, Button, ConfirmDialog, DatePicker, EmptyState, InlineError, Input, LoadingState, RecordList, RecordRow, Select, Sheet, SummaryCard } from '@/components/ui'
import { api, errorMessage } from '@/lib/client-api'
import { formatCurrency } from '@/lib/currency'
import type { Account } from './BankAccountsPanel'

const PAYMENT_TYPES = { RENT: 'Rent', UTILITY: 'Utility', SUBSCRIPTION: 'Subscription', INSURANCE: 'Insurance', FAMILY: 'Family support', SAVINGS: 'Savings', OTHER: 'Other' } as const
type PaymentType = keyof typeof PAYMENT_TYPES

type Plan = {
  id: string; name: string; type: PaymentType; amount: number; dueDay: number; isEssential: boolean; isActive: boolean
  startDate: string; endDate: string | null; archivedAt: string | null; accountId: string | null; account?: { id: string; name: string } | null
  payments?: { id: string; dueDate: string; amount: number; paidAt: string }[]
}

const blank = () => ({ name: '', type: 'OTHER' as PaymentType, amount: '', dueDay: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', accountId: '', isEssential: true })

function PlanForm({ initial, accounts, onSuccess }: { initial?: Plan; accounts: Account[]; onSuccess: () => void }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, type: initial.type, amount: String(initial.amount), dueDay: String(initial.dueDay), startDate: initial.startDate.slice(0, 10),
    endDate: initial.endDate?.slice(0, 10) ?? '', accountId: initial.accountId ?? '', isEssential: initial.isEssential,
  } : blank())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await api(initial ? `/api/payment-plans/${initial.id}` : '/api/payment-plans', { method: initial ? 'PATCH' : 'POST', body: {
        name: form.name, type: form.type, amount: Number(form.amount), dueDay: Number(form.dueDay), startDate: form.startDate || undefined,
        endDate: form.endDate || null, accountId: form.accountId || null, isEssential: form.isEssential,
      } })
      onSuccess()
    } catch (cause) { setError(errorMessage(cause, 'Unable to save payment')) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Input label="Payment name" value={form.name} onChange={field('name')} placeholder="e.g. Electricity" required />
      <Select label="Type" value={form.type} onChange={field('type')}>{Object.entries(PAYMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <div className="grid grid-cols-2 gap-3"><Input label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={field('amount')} required /><Input label="Due day" type="number" min="1" max="31" value={form.dueDay} onChange={field('dueDay')} required /></div>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><DatePicker label="Starts" value={form.startDate} onChange={field('startDate')} required /><DatePicker label="Ends (optional)" value={form.endDate} onChange={field('endDate')} /></div>
      <Select label="Default payment account" value={form.accountId} onChange={field('accountId')}><option value="">Choose when paying</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
      <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-offset p-3 text-sm dark:bg-gray-800"><input type="checkbox" checked={form.isEssential} onChange={event => setForm(current => ({ ...current, isEssential: event.target.checked }))} /> Required payment (reserved in the forecast)</label>
      <InlineError message={error} />
      <Button type="submit" size="lg" loading={saving}>{initial ? 'Save changes' : 'Add payment'}</Button>
    </form>
  )
}

export function RecurringPaymentsPanel() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filter, setFilter] = useState<'active' | 'paused' | 'archived'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<{ edit?: Plan } | null>(null)
  const [history, setHistory] = useState<Plan | null>(null)
  const [pausing, setPausing] = useState<Plan | null>(null)
  const [archiving, setArchiving] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, accountList] = await Promise.all([api<Plan[]>('/api/payment-plans?archived=1&history=1'), api<Account[]>('/api/accounts')])
      setPlans(list); setAccounts(accountList); setError('')
    } catch (cause) { setError(errorMessage(cause, 'Unable to load recurring payments')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function setActive(plan: Plan, isActive: boolean) {
    setBusy(true); setError('')
    try { await api(`/api/payment-plans/${plan.id}`, { method: 'PATCH', body: { isActive } }); setPausing(null); await load() } catch (cause) { setError(errorMessage(cause, 'Unable to update payment')); setPausing(null) } finally { setBusy(false) }
  }

  async function setArchived(plan: Plan, archived: boolean) {
    setBusy(true); setError('')
    try { await api(`/api/payment-plans/${plan.id}`, { method: 'PATCH', body: { archived } }); setArchiving(null); await load() } catch (cause) { setError(errorMessage(cause, 'Unable to update payment')); setArchiving(null) } finally { setBusy(false) }
  }

  const visible = plans.filter(plan => filter === 'archived' ? Boolean(plan.archivedAt) : !plan.archivedAt && plan.isActive === (filter === 'active'))
  const monthly = plans.filter(plan => plan.isActive && !plan.archivedAt).reduce((sum, plan) => sum + Number(plan.amount), 0)
  return (
    <div className="space-y-3">
      <SummaryCard label="Recurring commitments each month" value={formatCurrency(monthly)} detail={`${plans.filter(plan => plan.isActive && !plan.archivedAt).length} active · tracked monthly in Payments`} />
      <Button onClick={() => setSheet({})} variant="outline" className="w-full gap-2"><Plus size={16} aria-hidden /> Add recurring payment</Button>
      <div className="flex gap-2" role="group" aria-label="Filter recurring payments">
        {(['active', 'paused', 'archived'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'primary' : 'outline'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'active' ? 'Active' : value === 'paused' ? 'Paused' : 'Archived'}</Button>)}
      </div>
      <InlineError message={error} />
      {loading ? <LoadingState label="Loading recurring payments…" /> : visible.length === 0 ? <EmptyState icon={<CalendarClock />} title={filter === 'active' ? 'No recurring payments yet' : filter === 'paused' ? 'Nothing paused' : 'Nothing archived'} description="Rent, utilities, subscriptions, insurance and similar repeating payments live here." /> : (
        <RecordList label="Recurring payments">
          {visible.map(plan => (
            <RecordRow key={plan.id} muted={!plan.isActive}
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock size={16} aria-hidden /></div>}
              title={<span className="flex items-center gap-1.5">{plan.name}{!plan.isEssential && <Badge className="bg-surface-offset text-[10px] text-gray-500 dark:bg-gray-800">Optional</Badge>}</span>}
              subtitle={`${PAYMENT_TYPES[plan.type]} · due on ${plan.dueDay}${plan.account ? ` · ${plan.account.name}` : ''}${plan.endDate ? ` · ends ${new Date(plan.endDate).toLocaleDateString('en-IN')}` : ''}`}
              amount={formatCurrency(plan.amount)}
              actions={<>
                <button type="button" aria-label={`Payment history for ${plan.name}`} onClick={() => setHistory(plan)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-offset dark:hover:bg-gray-800"><History size={15} aria-hidden /></button>
                <button type="button" aria-label={`Edit ${plan.name}`} onClick={() => setSheet({ edit: plan })} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-offset dark:hover:bg-gray-800"><Edit2 size={15} aria-hidden /></button>
                {!plan.archivedAt && <button type="button" aria-label={plan.isActive ? `Pause ${plan.name}` : `Resume ${plan.name}`} onClick={() => plan.isActive ? setPausing(plan) : setActive(plan, true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-offset dark:hover:bg-gray-800">{plan.isActive ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}</button>}
                <button type="button" aria-label={plan.archivedAt ? `Unarchive ${plan.name}` : `Archive ${plan.name}`} onClick={() => plan.archivedAt ? setArchived(plan, false) : setArchiving(plan)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-offset dark:hover:bg-gray-800">{plan.archivedAt ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />}</button>
              </>} />
          ))}
        </RecordList>
      )}
      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.edit ? 'Edit recurring payment' : 'Add recurring payment'}>{sheet && <PlanForm initial={sheet.edit} accounts={accounts} onSuccess={() => { setSheet(null); load() }} />}</Sheet>
      <Sheet open={Boolean(history)} onClose={() => setHistory(null)} title={`${history?.name ?? ''} history`}>
        {history && (history.payments?.length ? <ul className="divide-y divide-border pb-4 dark:divide-gray-800">{history.payments.map(item => <li key={item.id} className="flex justify-between py-3 text-sm"><span>Due {new Date(item.dueDate).toLocaleDateString('en-IN')} · paid {new Date(item.paidAt).toLocaleDateString('en-IN')}</span><span className="font-semibold tabular-nums">{formatCurrency(item.amount)}</span></li>)}</ul> : <p className="pb-4 text-sm text-gray-500">No payments recorded yet.</p>)}
      </Sheet>
      <ConfirmDialog open={Boolean(archiving)} title="Archive recurring payment" confirmLabel="Archive" loading={busy} message={`Archive ${archiving?.name ?? 'this payment'}? It leaves Payments and the forecast for good, but its paid history stays here under Archived and you can unarchive it.`} onConfirm={() => archiving && setArchived(archiving, true)} onCancel={() => setArchiving(null)} />
      <ConfirmDialog open={Boolean(pausing)} title="Pause recurring payment" confirmLabel="Pause" loading={busy} message={`Pause ${pausing?.name ?? 'this payment'}? It stops appearing in Payments and the forecast. Paid history is kept and you can resume it any time.`} onConfirm={() => pausing && setActive(pausing, false)} onCancel={() => setPausing(null)} />
    </div>
  )
}
