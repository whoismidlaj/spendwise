'use client'
import { useCallback, useEffect, useState } from 'react'
import { Edit2, History, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, DatePicker, EmptyState, InlineError, Input, LoadingState, ProgressBar, Select, Sheet, SummaryCard } from '@/components/ui'
import { CardPaymentForm } from '@/components/CardPaymentForm'
import { InstitutionLogo } from '@/components/InstitutionLogo'
import { ReconcileForm, ReconcileTarget } from '@/components/ReconcileForm'
import { INSTITUTIONS, InstitutionId, inferInstitution } from '@/lib/institutions'
import { api, errorMessage } from '@/lib/client-api'
import { formatCurrency } from '@/lib/currency'
import type { Account } from './BankAccountsPanel'

export interface CreditCard { id: string; name: string; bank: string; institution: InstitutionId; totalLimit: number; usedLimit: number; dueAmount: number; minimumDue: number; expectedDue: number | null; billDueDate: string | null; dueDate: number; statementDate: number; color: string; type: 'CARD' | 'PAYLATER' }
type CardBill = { id: string; dueDate: string; statementAmount: number; minimumDue: number; paidAmount: number; paidAt: string | null }

const CARD_COLORS = ['#1a1a2e', '#003087', '#8b0000', '#1b4332', '#1e3a5f', '#2d1b69']

function CreditCardForm({ onSuccess, initial }: { onSuccess: () => void; initial?: CreditCard }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '', bank: initial?.bank ?? '', institution: initial?.institution ?? inferInstitution(initial?.bank, 'card'),
    totalLimit: String(initial?.totalLimit ?? ''), usedLimit: String(initial?.usedLimit ?? ''),
    dueAmount: String(initial?.dueAmount ?? ''), minimumDue: String(initial?.minimumDue ?? ''),
    expectedDue: String(initial?.expectedDue ?? ''), billDueDate: initial?.billDueDate?.slice(0, 10) ?? '',
    dueDate: String(initial?.dueDate ?? ''), statementDate: String(initial?.statementDate ?? ''), color: initial?.color ?? CARD_COLORS[0],
    type: initial?.type ?? 'CARD' as 'CARD' | 'PAYLATER',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(Boolean(initial?.dueAmount || initial?.minimumDue || initial?.expectedDue || initial?.billDueDate))
  const field = (key: string) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      await api(initial ? `/api/credit-cards/${initial.id}` : '/api/credit-cards', { method: initial ? 'PATCH' : 'POST', body: {
        ...form, totalLimit: parseFloat(form.totalLimit), usedLimit: parseFloat(form.usedLimit) || 0,
        dueAmount: parseFloat(form.dueAmount) || 0, minimumDue: parseFloat(form.minimumDue) || 0,
        expectedDue: form.expectedDue === '' ? null : Number(form.expectedDue), billDueDate: form.billDueDate || null,
        dueDate: parseInt(form.dueDate), statementDate: parseInt(form.statementDate) || 1,
      } })
      onSuccess()
    } catch (cause) { setError(errorMessage(cause, 'Unable to save card')) } finally { setLoading(false) }
  }

  const payLater = form.type === 'PAYLATER'
  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Select label="What are you adding?" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as 'CARD' | 'PAYLATER' }))}>
        <option value="CARD">Credit card</option><option value="PAYLATER">Pay later</option>
      </Select>
      <Select label={payLater ? 'Provider' : 'Bank'} value={form.institution} onChange={event => setForm(current => {
        const institution = event.target.value as InstitutionId
        return { ...current, institution, bank: institution === 'OTHER' ? current.bank : INSTITUTIONS[institution].label }
      })}>
        {Object.entries(INSTITUTIONS).filter(([, item]) => item.card).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </Select>
      <Input label={payLater ? 'Account name' : 'Card name'} value={form.name} onChange={field('name')} placeholder={payLater ? 'e.g. Amazon Pay Later' : 'e.g. HDFC Millennia'} required />
      {form.institution === 'OTHER' && <Input label="Provider name" value={form.bank} onChange={field('bank')} placeholder={payLater ? 'e.g. Amazon' : 'e.g. HDFC Bank'} required />}
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"><Input label="Total limit" type="number" min="0" step="0.01" value={form.totalLimit} onChange={field('totalLimit')} required /><Input label="Amount used" type="number" min="0" step="0.01" value={form.usedLimit} onChange={field('usedLimit')} /></div>
      <Input label="Payment due day" type="number" min="1" max="31" value={form.dueDate} onChange={field('dueDate')} placeholder="e.g. 15" required />
      <p className="text-xs text-gray-500">You can update the current bill amount after your next statement arrives.</p>
      <button type="button" aria-expanded={showBillDetails} onClick={() => setShowBillDetails(value => !value)} className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-surface-offset px-3 text-left text-sm font-semibold dark:bg-gray-800"><span>{showBillDetails ? 'Hide bill details' : 'Add bill details (optional)'}</span><span aria-hidden className="text-lg font-normal text-gray-400">{showBillDetails ? '−' : '+'}</span></button>
      {showBillDetails && <div className="space-y-4 rounded-xl border border-border p-3 dark:border-gray-700">
        <Input label="Expected bill amount" type="number" min="0" step="0.01" value={form.expectedDue} onChange={field('expectedDue')} placeholder="Automatic from amount used" />
        <Input label="Actual bill remaining" type="number" min="0" step="0.01" value={form.dueAmount} onChange={field('dueAmount')} />
        <Input label="Minimum due" type="number" min="0" step="0.01" value={form.minimumDue} onChange={field('minimumDue')} />
        <DatePicker label="Current bill due date" value={form.billDueDate} onChange={field('billDueDate')} />
        <Input label="Statement day (optional)" type="number" min="1" max="31" value={form.statementDate} onChange={field('statementDate')} placeholder="e.g. 1" />
      </div>}
      <InlineError message={error} />
      <Button type="submit" size="lg" loading={loading}>{initial ? 'Update' : 'Add'}</Button>
    </form>
  )
}

export function CardsPanel() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<{ edit?: CreditCard } | null>(null)
  const [payCard, setPayCard] = useState<CreditCard | null>(null)
  const [reconcile, setReconcile] = useState<ReconcileTarget | null>(null)
  const [deleting, setDeleting] = useState<CreditCard | null>(null)
  const [history, setHistory] = useState<{ card: CreditCard; bills: CardBill[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  const load = useCallback(async () => {
    try {
      const [cardList, accountList] = await Promise.all([api<CreditCard[]>('/api/credit-cards'), api<Account[]>('/api/accounts')])
      setCards(cardList); setAccounts(accountList); setError('')
    } catch (cause) { setError(errorMessage(cause, 'Unable to load cards')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); setMounted(true) }, [load])

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try { await api(`/api/credit-cards/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); await load() } catch (cause) { setError(errorMessage(cause, 'Unable to delete card')); setDeleting(null) } finally { setBusy(false) }
  }
  async function openHistory(card: CreditCard) {
    try { setHistory({ card, bills: await api<CardBill[]>(`/api/credit-cards/${card.id}/bills`) }) } catch (cause) { setError(errorMessage(cause, 'Unable to load statement history')) }
  }

  const used = cards.reduce((sum, card) => sum + Number(card.usedLimit), 0)
  const limit = cards.reduce((sum, card) => sum + Number(card.totalLimit), 0)
  const due = cards.reduce((sum, card) => sum + Number(card.dueAmount || card.expectedDue || 0), 0)

  return (
    <div className="space-y-3">
      <SummaryCard label="Total card balance in use" value={formatCurrency(used)} detail={`${cards.length} account${cards.length === 1 ? '' : 's'} · ${formatCurrency(limit - used)} available · ${formatCurrency(due)} due`} />
      <Button onClick={() => setSheet({})} variant="outline" className="w-full gap-2"><Plus size={16} aria-hidden /> Add card or pay later</Button>
      <InlineError message={error} />
      {loading ? <LoadingState label="Loading cards…" /> : cards.length === 0 ? <EmptyState title="No cards yet" description="Credit cards and pay-later accounts are managed here." /> : cards.map(card => {
        const overdue = mounted && card.dueAmount > 0 && (card.billDueDate ? new Date(`${card.billDueDate.slice(0, 10)}T23:59:59`) < new Date() : new Date().getDate() > card.dueDate)
        return (
          <Card key={card.id} className="p-3.5 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex min-w-0 gap-2.5">
                <InstitutionLogo institution={card.institution} size={36} />
                <div className="min-w-0">
                  <div className="mb-1 flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{card.bank}</p>
                    <Badge className="shrink-0 bg-surface-offset px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{card.type === 'PAYLATER' ? 'Pay later' : 'Credit card'}</Badge>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate font-semibold dark:text-white">{card.name}</p>
                    {overdue && <Badge className="bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">Overdue</Badge>}
                    {card.usedLimit > card.totalLimit && <Badge className="bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">Over limit</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button type="button" aria-label={`Edit ${card.name}`} onClick={() => setSheet({ edit: card })} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-offset dark:hover:bg-gray-800"><Edit2 size={14} className="text-gray-400" aria-hidden /></button>
                <button type="button" aria-label={`Delete ${card.name}`} onClick={() => setDeleting(card)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-offset dark:hover:bg-gray-800"><Trash2 size={14} className="text-danger" aria-hidden /></button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={card.usedLimit <= 0} onClick={() => setPayCard(card)}>Record payment</Button>
              <Button variant="outline" size="sm" onClick={() => setReconcile({ id: card.id, name: card.name, type: 'card', currentValue: Number(card.usedLimit) })} className="gap-1"><SlidersHorizontal size={13} aria-hidden />Adjust usage</Button>
              <Button variant="outline" size="sm" onClick={() => openHistory(card)} className="gap-1"><History size={13} aria-hidden />Statements</Button>
            </div>
            <ProgressBar value={card.usedLimit} max={card.totalLimit} className="mb-3" />
            <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[['Used', card.usedLimit, ''], ['Available', card.totalLimit - card.usedLimit, 'text-success'], ['Statement due', card.dueAmount, 'text-danger'], ['Minimum due', card.minimumDue, 'text-danger']].map(([label, value, tone]) => (
                <div key={label as string}><dt className="text-xs text-gray-400">{label}</dt><dd className={`whitespace-nowrap text-sm font-semibold tabular-nums dark:text-white ${tone}`}>{formatCurrency(value as number)}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-sm dark:text-gray-200">Expected due: {formatCurrency(card.expectedDue ?? Math.max(0, card.usedLimit))} <span className="text-xs text-gray-400">({card.expectedDue === null ? 'from usage' : 'manual estimate'})</span></p>
            {card.billDueDate && <p className="text-xs text-gray-400">Current bill due: {new Date(card.billDueDate).toLocaleDateString('en-IN')}</p>}
            <p className="mt-2 text-center text-xs text-gray-400">Due on the {card.dueDate}th · statement on the {card.statementDate}th</p>
          </Card>
        )
      })}
      <Sheet open={Boolean(payCard)} onClose={() => setPayCard(null)} title={`Pay ${payCard?.name ?? 'card'}`}>{payCard && <CardPaymentForm card={payCard} accounts={accounts} onSuccess={() => { setPayCard(null); load() }} />}</Sheet>
      <Sheet open={Boolean(reconcile)} onClose={() => setReconcile(null)} title={`Adjust ${reconcile?.name ?? ''} usage`}>{reconcile && <ReconcileForm target={reconcile} onSuccess={() => { setReconcile(null); load() }} onCancel={() => setReconcile(null)} />}</Sheet>
      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.edit ? 'Edit card' : 'Add card or pay later'}>{sheet && <CreditCardForm initial={sheet.edit} onSuccess={() => { setSheet(null); load() }} />}</Sheet>
      <Sheet open={Boolean(history)} onClose={() => setHistory(null)} title={`${history?.card.name ?? ''} statements`}>
        {history && (history.bills.length === 0 ? <p className="pb-4 text-sm text-gray-500">Statement cycles appear here once a payment is recorded.</p> : <ul className="divide-y divide-border pb-4 dark:divide-gray-800">
          {history.bills.map(bill => <li key={bill.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">Due {new Date(bill.dueDate).toLocaleDateString('en-IN')}</p><p className="text-xs text-gray-500">Statement {formatCurrency(bill.statementAmount)} · minimum {formatCurrency(bill.minimumDue)}</p></div><div className="text-right"><p className="font-bold tabular-nums">{formatCurrency(bill.paidAmount)}</p><p className="text-xs text-gray-500">{bill.paidAt ? 'Paid in full' : bill.paidAmount > 0 ? 'Partly paid' : 'Unpaid'}</p></div></li>)}
        </ul>)}
      </Sheet>
      <ConfirmDialog open={Boolean(deleting)} title="Delete card" destructive confirmLabel="Delete" loading={busy} message={`Delete ${deleting?.name ?? 'this card'}?`} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
