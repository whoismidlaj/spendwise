'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { InstitutionLogo } from '@/components/InstitutionLogo'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string; institution?: string; type?: string }
type CreditCard = { id: string; name: string; bank: string; institution?: string; type: 'CARD' | 'PAYLATER' }

function AccountPicker({ accounts, value, onChange, label, excludeId }: { accounts: Account[]; value: string; onChange: (id: string) => void; label: string; excludeId?: string }) {
  const available = accounts.filter(account => account.id !== excludeId)
  return <div className="space-y-1.5"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>{available.length === 0 ? <p className="rounded-xl bg-surface-offset p-3 text-xs text-gray-500 dark:bg-gray-800">No account available.</p> : <div className="grid grid-cols-2 gap-2">{available.map(account => {
    const selected = value === account.id
    return <button key={account.id} type="button" aria-pressed={selected} onClick={() => onChange(account.id)} className={cn('relative flex min-h-[58px] min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition-colors', selected ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-white dark:border-gray-700 dark:bg-gray-900')}>
      <InstitutionLogo institution={account.institution} size={28} />
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{account.name}</span><span className="block truncate text-[10px] text-gray-500">{account.type === 'CASH' ? 'Cash' : account.type === 'WALLET' ? 'Wallet' : 'Bank account'}</span></span>
      {selected && <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"><Check size={10} strokeWidth={3} /></span>}
    </button>
  })}</div>}</div>
}

function CardPicker({ cards, value, onChange }: { cards: CreditCard[]; value: string; onChange: (id: string) => void }) {
  return <div className="space-y-1.5"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Card or Pay Later</p>{cards.length === 0 ? <p className="rounded-xl bg-surface-offset p-3 text-xs text-gray-500 dark:bg-gray-800">No card or Pay Later account available.</p> : <div className="grid grid-cols-2 gap-2">{cards.map(card => {
    const selected = value === card.id
    return <button key={card.id} type="button" aria-pressed={selected} onClick={() => onChange(card.id)} className={cn('relative flex min-h-[58px] min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition-colors', selected ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-white dark:border-gray-700 dark:bg-gray-900')}>
      <InstitutionLogo institution={card.institution} size={28} />
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{card.name}</span><span className="block truncate text-[10px] text-gray-500">{card.bank}</span></span>
      {selected && <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"><Check size={10} strokeWidth={3} /></span>}
    </button>
  })}</div>}</div>
}

export function QuickTransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [mode, setMode] = useState<'PAYMENT' | 'TRANSFER'>('PAYMENT')
  const [source, setSource] = useState<'ACCOUNT' | 'CARD'>('ACCOUNT')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [accountId, setAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/accounts'), fetch('/api/credit-cards')])
      .then(async ([accountResponse, cardResponse]) => [await accountResponse.json(), await cardResponse.json()] as [Account[], CreditCard[]])
      .then(([loadedAccounts, loadedCards]) => {
        setAccounts(loadedAccounts)
        setCards(loadedCards)
        setAccountId(loadedAccounts[0]?.id || '')
        setToAccountId(loadedAccounts[1]?.id || '')
        setCreditCardId(loadedCards[0]?.id || '')
      })
      .catch(() => setError('Unable to load accounts'))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, amount: Number(amount), name, date,
          occurredAt: new Date(`${date}T${time}:00`).toISOString(),
          accountId: mode === 'TRANSFER' || source === 'ACCOUNT' ? accountId : null,
          creditCardId: mode === 'PAYMENT' && source === 'CARD' ? creditCardId : null,
          toAccountId: mode === 'TRANSFER' ? toAccountId : null,
        }),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save payment')
      onSuccess()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save payment')
    } finally {
      setLoading(false)
    }
  }

  const hasPaymentSource = source === 'ACCOUNT' ? Boolean(accountId) : Boolean(creditCardId)
  const canSubmit = mode === 'PAYMENT' ? hasPaymentSource : Boolean(accountId && toAccountId && accountId !== toAccountId)

  return <form onSubmit={submit} className="space-y-4 pb-4">
    <div className="grid grid-cols-2 rounded-xl bg-surface-offset p-1 dark:bg-gray-800">
      {([['PAYMENT', 'Payment'], ['TRANSFER', 'Transfer']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={cn('rounded-lg px-3 py-2 text-sm font-semibold', mode === value ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500')}>{label}</button>)}
    </div>
    {mode === 'PAYMENT' && <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setSource('ACCOUNT')} className={cn('min-h-11 rounded-xl border px-2 text-xs font-semibold', source === 'ACCOUNT' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-gray-500 dark:border-gray-700')}>Bank / wallet</button>
      <button type="button" onClick={() => setSource('CARD')} className={cn('min-h-11 rounded-xl border px-2 text-xs font-semibold', source === 'CARD' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-gray-500 dark:border-gray-700')}>Card / Pay Later</button>
    </div>}
    <Input label="Amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className="text-2xl font-bold tabular-nums" required />
    <Input label={mode === 'TRANSFER' ? 'Transfer note' : 'What did you pay for?'} value={name} onChange={event => setName(event.target.value)} placeholder={mode === 'TRANSFER' ? 'e.g. Move to savings' : 'e.g. Groceries'} required />
    <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3"><Input label="Date" type="date" value={date} onChange={event => setDate(event.target.value)} required /><Input label="Time" type="time" value={time} onChange={event => setTime(event.target.value)} required /></div>
    {mode === 'PAYMENT' && source === 'ACCOUNT' && <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Paid from" />}
    {mode === 'PAYMENT' && source === 'CARD' && <CardPicker cards={cards} value={creditCardId} onChange={setCreditCardId} />}
    {mode === 'TRANSFER' && <div className="space-y-3"><AccountPicker accounts={accounts} value={accountId} onChange={id => { setAccountId(id); if (toAccountId === id) setToAccountId(accounts.find(account => account.id !== id)?.id || '') }} label="From account" /><AccountPicker accounts={accounts} value={toAccountId} onChange={setToAccountId} label="To account" excludeId={accountId} /></div>}
    {mode === 'PAYMENT' && source === 'CARD' && <p className="text-xs text-gray-500">This increases current usage and the expected due. Your issued bill and minimum due stay unchanged.</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button type="submit" size="lg" loading={loading} disabled={!canSubmit}>{mode === 'TRANSFER' ? 'Record transfer' : 'Add payment'}</Button>
  </form>
}
