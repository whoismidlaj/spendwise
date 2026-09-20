'use client'
import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'

export function CardPaymentForm({ card, accounts, onSuccess }: {
  card: { id: string; dueAmount: number; usedLimit: number; minimumDue: number }
  accounts: { id: string; name: string }[]
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(String(card.dueAmount || Math.max(0, card.usedLimit)))
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const response = await fetch(`/api/credit-cards/${card.id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), accountId: accountId || undefined }),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to record payment')
      onSuccess()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to record payment') }
    finally { setLoading(false) }
  }
  return <form onSubmit={submit} className="space-y-4 pb-4">
    <Input id="card-payment-amount" label="Payment Amount" type="number" min="0.01" step="0.01" max={card.usedLimit} value={amount} onChange={e => setAmount(e.target.value)} required />
    <div className="flex gap-2">
      {card.minimumDue > 0 && <Button id="card-pay-minimum" type="button" variant="outline" onClick={() => setAmount(String(card.minimumDue))}>Minimum due</Button>}
      {card.dueAmount > 0 && <Button id="card-pay-bill" type="button" variant="outline" onClick={() => setAmount(String(card.dueAmount))}>Full bill</Button>}
    </div>
    <Select id="card-payment-account" label="Pay From" value={accountId} onChange={e => setAccountId(e.target.value)}>
      <option value="">Paid externally</option>
      {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
    </Select>
    <p className="text-xs text-gray-500">This reduces your outstanding balance and remaining dues. It is recorded as a transfer, so purchases are not counted twice.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button id="confirm-card-payment" type="submit" loading={loading}>Record Payment</Button>
  </form>
}
