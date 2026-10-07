'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Undo2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, InlineError, Input, LoadingState, PageContainer, RecordList, Select, Sheet, SummaryCard } from '@/components/ui'
import { formatCurrency } from '@/lib/currency'
import type { Obligation } from '@/lib/obligations'

type Account = { id: string; name: string }
type Row = Omit<Obligation, 'dueDate' | 'paidAt'> & { dueDate: string; paidAt?: string }
type Checklist = { month: string; items: Row[]; summary: { total: number; paid: number; remaining: number; overdueCount: number } }

const sourceLabel: Record<string, string> = { RECURRING: 'Recurring', LOAN: 'Loan', DEBT: 'Debt', CARD: 'Card bill' }
const today = () => new Date().toISOString().slice(0, 10)
const dayLabel = (date: string) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const dateOnly = (date: string) => new Date(date).toLocaleDateString('en-CA')

async function request(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Request failed')
}

function payRequest(item: Row, accountId: string, paidDate: string) {
  const due = dateOnly(item.dueDate)
  if (item.sourceType === 'RECURRING') return request(`/api/payment-plans/${item.sourceId}/pay`, 'POST', { dueDate: due, amount: item.amount, accountId })
  if (item.sourceType === 'CARD') return request(`/api/credit-cards/${item.sourceId}/pay`, 'POST', { amount: item.amount, accountId, dueDate: due, paidDate })
  return request(`/api/debts/${item.sourceId}/pay`, 'POST', { amount: item.amount, accountId, paidDate, ...(item.installmentNumber ? { installmentNumber: item.installmentNumber } : {}) })
}

function undoRequest(item: Row) {
  if (item.sourceType === 'RECURRING') return request(`/api/payment-plans/${item.sourceId}/pay`, 'DELETE', { dueDate: dateOnly(item.dueDate) })
  if (item.sourceType === 'CARD') return request(`/api/credit-cards/${item.sourceId}/pay`, 'DELETE', { paymentId: item.paymentId })
  return request(`/api/debts/${item.sourceId}/pay`, 'DELETE', { paymentId: item.paymentId })
}

export default function PaymentsPage() {
  const [data, setData] = useState<Checklist | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState<Row | null>(null)
  const [undoing, setUndoing] = useState<Row | null>(null)
  const [accountId, setAccountId] = useState('')
  const [paidDate, setPaidDate] = useState(today())

  async function load() {
    setLoading(true); setError('')
    try {
      const [obligations, accountResponse] = await Promise.all([fetch('/api/obligations'), fetch('/api/accounts')])
      if (!obligations.ok) throw new Error((await obligations.json()).error || 'Unable to load payments')
      setData(await obligations.json())
      if (accountResponse.ok) setAccounts(await accountResponse.json())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load payments') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function run(action: () => Promise<void>, done: () => void) {
    setSaving(true); setError('')
    try { await action(); done(); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update payment') } finally { setSaving(false) }
  }

  const items = data?.items ?? []
  const groups = [
    { title: 'Overdue', rows: items.filter(item => item.status === 'OVERDUE') },
    { title: 'Upcoming', rows: items.filter(item => item.status === 'UPCOMING') },
    { title: 'Paid', rows: items.filter(item => item.status === 'PAID') },
  ].filter(group => group.rows.length)

  return <PageContainer>
    <SummaryCard label="Still to pay this month" value={formatCurrency(data?.summary.remaining ?? 0)} detail={`${formatCurrency(data?.summary.paid ?? 0)} paid · ${data?.summary.overdueCount ? `${data.summary.overdueCount} overdue` : 'Nothing overdue'}`} />
    <InlineError message={error} />
    {loading && !data ? <LoadingState label="Loading payments…" /> : items.length === 0 ? <EmptyState icon={<CalendarClock />} title="No payments this month" description="Recurring payments, loans, and card bills added in Accounts appear here." /> : groups.map(group => <section key={group.title} aria-label={group.title} className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-gray-500">{group.title} · {group.rows.length}</h2>
      <RecordList label={group.title}>{group.rows.map(item => <li key={item.key} className={`flex items-center gap-3 px-3.5 py-3.5 ${item.status === 'PAID' ? 'opacity-70' : ''}`}>
        <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl ${item.status === 'OVERDUE' ? 'bg-danger/10 text-danger' : item.status === 'PAID' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{item.status === 'PAID' ? <CheckCircle2 size={15} aria-hidden /> : <CalendarClock size={15} aria-hidden />}<span className="text-[9px] font-bold">{new Date(item.dueDate).getDate()}</span></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-semibold">{item.name}</p>{item.installmentNumber && <Badge className="text-[10px]">#{item.installmentNumber}</Badge>}</div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{dayLabel(item.dueDate)} · {item.isRequired ? 'Required' : 'Optional'} · {sourceLabel[item.sourceType]}{item.status === 'PAID' && item.paidAt ? ` · paid ${dayLabel(item.paidAt)}` : ''}{item.interest !== undefined && item.principal !== undefined ? ` · ${formatCurrency(item.principal)} principal, ${formatCurrency(item.interest)} interest` : ''}</p></div>
        <div className="shrink-0 text-right"><p className="text-sm font-bold tabular-nums">{formatCurrency(item.amount)}</p>
          {item.actions.includes('pay') && <Button size="sm" className="mt-1 gap-1" onClick={() => { setPaying(item); setAccountId(''); setPaidDate(today()) }} aria-label={`Mark ${item.name} paid`}><CheckCircle2 size={13} aria-hidden /> Paid</Button>}
          {item.actions.includes('unpay') && <Button size="sm" variant="outline" className="mt-1 gap-1" onClick={() => setUndoing(item)} aria-label={`Mark ${item.name} unpaid`}><Undo2 size={13} aria-hidden /> Undo</Button>}</div>
      </li>)}</RecordList></section>)}

    <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} title="Mark payment as paid">{paying && <form className="space-y-4 pb-4" onSubmit={event => { event.preventDefault(); run(() => payRequest(paying, accountId, paidDate), () => setPaying(null)) }}><div className="rounded-xl bg-surface-offset p-3 dark:bg-gray-800"><p className="font-semibold">{paying.name}</p><p className="mt-1 text-sm text-gray-500">Due {dayLabel(paying.dueDate)} · {formatCurrency(paying.amount)}</p></div><Select label="Paid from account" value={accountId} onChange={event => setAccountId(event.target.value)} required><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><Input label="Paid on" type="date" value={paidDate} max={today()} onChange={event => setPaidDate(event.target.value)} required />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" loading={saving} disabled={!accountId}>Mark paid</Button></form>}</Sheet>
    <Sheet open={Boolean(undoing)} onClose={() => setUndoing(null)} title="Mark payment as unpaid">{undoing && <div className="space-y-4 pb-4"><p className="text-sm text-gray-600 dark:text-gray-300">This returns {formatCurrency(undoing.amount)} for {undoing.name} to the account it was paid from and restores the balance owed.</p>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button loading={saving} onClick={() => run(() => undoRequest(undoing), () => setUndoing(null))}>Mark unpaid</Button></div>}</Sheet>
  </PageContainer>
}
