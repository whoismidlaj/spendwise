'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card, Button, Sheet, Input, Select, Badge, ProgressBar } from '@/components/ui'
import { Plus, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { CardPaymentForm } from '@/components/CardPaymentForm'
import { cn } from '@/lib/utils'

interface Account { id: string; name: string; type: string; balance: number; color: string }
interface CreditCard { id: string; name: string; bank: string; totalLimit: number; usedLimit: number; dueAmount: number; minimumDue: number; expectedDue: number | null; billDueDate: string | null; dueDate: number; statementDate: number; color: string; type: 'CARD' | 'PAYLATER' }

const COLORS = ['#01696f', '#006494', '#5f259f', '#dc2626', '#d97706', '#16a34a']
const CARD_COLORS = ['#1a1a2e', '#003087', '#8b0000', '#1b4332', '#1e3a5f', '#2d1b69']

function AccountForm({ onSuccess, initial }: { onSuccess: () => void; initial?: Account }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? 'BANK')
  const [balance, setBalance] = useState(String(initial?.balance ?? ''))
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const url = initial ? `/api/accounts/${initial.id}` : '/api/accounts'
    const method = initial ? 'PATCH' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, balance: parseFloat(balance), color }) })
    setLoading(false); onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Input label="Account Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HDFC Savings" required />
      <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
        <option value="BANK">Bank Account</option>
        <option value="WALLET">Wallet</option>
        <option value="CASH">Cash</option>
      </Select>
      {!initial && <Input label="Opening Balance" type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" />}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Color</label>
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={cn('w-8 h-8 rounded-full transition-all', color === c ? 'ring-2 ring-offset-2 ring-gray-400' : '')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <Button type="submit" size="lg" loading={loading}>{initial ? 'Update Account' : 'Add Account'}</Button>
    </form>
  )
}

function CreditCardForm({ onSuccess, initial }: { onSuccess: () => void; initial?: CreditCard }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '', bank: initial?.bank ?? '',
    totalLimit: String(initial?.totalLimit ?? ''), usedLimit: String(initial?.usedLimit ?? ''),
    dueAmount: String(initial?.dueAmount ?? ''), minimumDue: String(initial?.minimumDue ?? ''),
    expectedDue: String(initial?.expectedDue ?? ''), billDueDate: initial?.billDueDate?.slice(0, 10) ?? '',
    dueDate: String(initial?.dueDate ?? ''),
    statementDate: String(initial?.statementDate ?? ''), color: initial?.color ?? CARD_COLORS[0],
    type: initial?.type ?? 'CARD' as 'CARD' | 'PAYLATER',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const url = initial ? `/api/credit-cards/${initial.id}` : '/api/credit-cards'
      const method = initial ? 'PATCH' : 'POST'
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...form, totalLimit: parseFloat(form.totalLimit), usedLimit: parseFloat(form.usedLimit) || 0,
        dueAmount: parseFloat(form.dueAmount) || 0, minimumDue: parseFloat(form.minimumDue) || 0,
        expectedDue: form.expectedDue === '' ? null : Number(form.expectedDue),
        billDueDate: form.billDueDate || null,
        dueDate: parseInt(form.dueDate), statementDate: parseInt(form.statementDate),
      }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save card')
      onSuccess()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save card') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Select id="card-type" label="Type" value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value as any }))}>
        <option value="CARD">Credit Card</option>
        <option value="PAYLATER">Pay Later</option>
      </Select>
      <Input id="card-name" label={form.type === 'PAYLATER' ? "Account Name" : "Card Name"} value={form.name} onChange={f('name')} placeholder={form.type === 'PAYLATER' ? "e.g. Amazon Pay Later" : "e.g. HDFC Millennia"} required />
      <Input id="card-bank" label={form.type === 'PAYLATER' ? "Provider" : "Bank"} value={form.bank} onChange={f('bank')} placeholder={form.type === 'PAYLATER' ? "e.g. Amazon" : "e.g. HDFC Bank"} required />
      <Input id="card-totalLimit" label="Total Limit" type="number" min="0" step="0.01" value={form.totalLimit} onChange={f('totalLimit')} required />
      <Input id="card-usedLimit" label="Current Used Amount" type="number" min="0" step="0.01" value={form.usedLimit} onChange={f('usedLimit')} />
      <p className="text-xs text-gray-500">Recorded purchases update usage. Expected due follows usage unless you enter an override. Update the actual bill and minimum due from each new statement.</p>
      <Input id="card-expected-due" label="Expected Due (optional override)" type="number" min="0" step="0.01" value={form.expectedDue} onChange={f('expectedDue')} placeholder="Automatic from usage" />
      <Input id="card-dueAmount" label="Actual Bill Remaining" type="number" min="0" step="0.01" value={form.dueAmount} onChange={f('dueAmount')} />
      <Input id="card-minimumDue" label="Minimum Due Amount" type="number" min="0" step="0.01" value={form.minimumDue} onChange={f('minimumDue')} />
      <Input id="card-bill-due-date" label="Current Bill Due Date (optional)" type="date" value={form.billDueDate} onChange={f('billDueDate')} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="card-dueDate" label="Due Date (day)" type="number" min="1" max="31" value={form.dueDate} onChange={f('dueDate')} required />
        <Input id="card-statementDate" label="Statement Date (day)" type="number" min="1" max="31" value={form.statementDate} onChange={f('statementDate')} required />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Color</label>
        <div className="flex gap-2">
          {CARD_COLORS.map(c => (
            <button id={`card-color-${c.slice(1)}`} aria-label={`Use color ${c}`} key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
              className={cn('w-8 h-8 rounded-full transition-all', form.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : '')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button id="save-credit-card" type="submit" size="lg" loading={loading}>{initial ? 'Update' : 'Add'}</Button>
    </form>
  )
}

export default function AccountsPage() {
  const [payCard, setPayCard] = useState<CreditCard | null>(null)
  const [tab, setTab] = useState<'accounts' | 'cards'>('accounts')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ type: 'account' | 'card'; edit?: Account | CreditCard } | null>(null)
  const [mounted, setMounted] = useState(false)

  async function load() {
    const [a, c] = await Promise.all([fetch('/api/accounts').then(r => r.json()), fetch('/api/credit-cards').then(r => r.json())])
    setAccounts(a); setCards(c)
  }

  useEffect(() => {
    load()
    setMounted(true)
  }, [])

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account?')) return
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' }); load()
  }

  async function deleteCard(id: string) {
    if (!confirm('Delete this card?')) return
    await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="px-4 py-4">
      {/* Tab Switcher */}
      <div className="flex rounded-xl border border-border dark:border-gray-700 overflow-hidden mb-4">
        {(['accounts', 'cards'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-primary text-white' : 'text-gray-500 dark:text-gray-400')}>
            {t === 'accounts' ? 'Bank & Wallets' : 'Cards & Pay Later'}
          </button>
        ))}
      </div>

      {tab === 'accounts' && (
        <div className="space-y-3">
          <Button onClick={() => setSheet({ type: 'account' })} variant="outline" className="w-full gap-2">
            <Plus size={16} /> Add Account
          </Button>
          {accounts.map(acc => (
            <Card key={acc.id} className="overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4" onClick={() => setExpanded(expanded === acc.id ? null : acc.id)}>
                <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: acc.color }} />
                <div className="flex-1 text-left">
                  <p className="font-medium dark:text-white">{acc.name}</p>
                  <Badge className="mt-0.5 text-gray-500 dark:text-gray-400 bg-surface-offset dark:bg-gray-800">{acc.type}</Badge>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums dark:text-white">{formatCurrency(acc.balance)}</p>
                </div>
                <ChevronDown size={16} className={cn('text-gray-400 transition-transform ml-1', expanded === acc.id && 'rotate-180')} />
              </button>
              {expanded === acc.id && (
                <div className="flex gap-2 px-4 pb-4">
                  <Button variant="outline" size="sm" onClick={() => setSheet({ type: 'account', edit: acc })} className="gap-1">
                    <Edit2 size={13} />Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deleteAccount(acc.id)} className="gap-1">
                    <Trash2 size={13} />Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'cards' && (
        <div className="space-y-3">
          <Button onClick={() => setSheet({ type: 'card' })} variant="outline" className="w-full gap-2">
            <Plus size={16} /> Add Card / Pay Later
          </Button>
          {cards.map(card => {
            const pct = (card.usedLimit / card.totalLimit) * 100
            const available = card.totalLimit - card.usedLimit
            return (
              <Card key={card.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{card.bank}</p>
                        <Badge className="bg-surface-offset dark:bg-gray-800 text-[9px] text-gray-500 dark:text-gray-400 font-medium px-1.5 py-0.5 rounded">
                          {card.type === 'PAYLATER' ? 'Pay Later' : 'Credit Card'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold dark:text-white">{card.name}</p>
                        {mounted && card.dueAmount > 0 && (card.billDueDate ? new Date(card.billDueDate.slice(0, 10) + 'T23:59:59') < new Date() : new Date().getDate() > card.dueDate) && (
                          <Badge className="bg-danger/10 text-danger dark:bg-danger/20 text-[10px] font-semibold uppercase tracking-wider py-0.5 px-2">Overdue</Badge>
                        )}
                        {card.usedLimit > card.totalLimit && (
                          <Badge className="bg-warning/10 text-warning dark:bg-warning/20 text-[10px] font-semibold uppercase tracking-wider py-0.5 px-2">Over Limit</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSheet({ type: 'card', edit: card })} className="p-2 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                      <button onClick={() => deleteCard(card.id)} className="p-2 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </div>
                  </div>
                  <Button id={`pay-card-${card.id}`} variant="outline" size="sm" disabled={card.usedLimit <= 0} onClick={() => setPayCard(card)} className="mb-3">Record Payment</Button>
                  <ProgressBar value={card.usedLimit} max={card.totalLimit} className="mb-3" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-400">Used</p>
                      <p className="text-sm font-semibold tabular-nums dark:text-white">{formatCurrency(card.usedLimit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Available</p>
                      <p className="text-sm font-semibold tabular-nums text-success">{formatCurrency(available)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Actual bill</p>
                      <p className="text-sm font-semibold tabular-nums text-danger">{formatCurrency(card.dueAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Min Due</p>
                      <p className="text-sm font-semibold tabular-nums text-danger">{formatCurrency(card.minimumDue)}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-3 dark:text-gray-200">Expected due: {formatCurrency(card.expectedDue ?? Math.max(0, card.usedLimit))} <span className="text-xs text-gray-400">({card.expectedDue === null ? 'from usage' : 'manual estimate'})</span></p>
                  {card.billDueDate && <p className="text-xs text-gray-400">Current bill due: {new Date(card.billDueDate).toLocaleDateString('en-IN')}</p>}
                  <p className="text-xs text-gray-400 mt-2 text-center">Due on {card.dueDate}th · Statement on {card.statementDate}th</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={!!payCard} onClose={() => setPayCard(null)} title={`Pay ${payCard?.name ?? 'card'}`}>
        {payCard && <CardPaymentForm card={payCard} accounts={accounts} onSuccess={() => { setPayCard(null); load() }} />}
      </Sheet>
      <Sheet open={!!sheet} onClose={() => setSheet(null)}
        title={sheet?.type === 'account' ? (sheet.edit ? 'Edit Account' : 'Add Account') : (sheet?.edit ? 'Edit Card' : 'Add Credit Card')}>
        {sheet?.type === 'account' ? (
          <AccountForm onSuccess={() => { setSheet(null); load() }} initial={sheet.edit as Account} />
        ) : sheet?.type === 'card' ? (
          <CreditCardForm onSuccess={() => { setSheet(null); load() }} initial={sheet.edit as CreditCard} />
        ) : null}
      </Sheet>
    </div>
  )
}
