'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Button, Input, DatePicker } from '@/components/ui'
import { AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'

export interface ReconcileTarget {
  id: string
  name: string
  type: 'account' | 'card'
  currentValue: number
}

interface ReconcileFormProps {
  target: ReconcileTarget
  onSuccess: () => void
  onCancel?: () => void
}

export function ReconcileForm({ target, onSuccess, onCancel }: ReconcileFormProps) {
  const isAccount = target.type === 'account'
  const todayStr = new Date().toISOString().slice(0, 10)

  const [actualValue, setActualValue] = useState(String(target.currentValue))
  const [date, setDate] = useState(todayStr)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsedActual = parseFloat(actualValue)
  const isValidNumber = !isNaN(parsedActual) && (isAccount || parsedActual >= 0)
  const diff = isValidNumber ? Math.round((parsedActual - target.currentValue) * 100) / 100 : 0
  const isZeroDiff = diff === 0

  // For accounts: positive diff means money was gained (income), negative means money was spent (expense)
  // For cards: positive diff means more was spent on the card (expense), negative means card balance was reduced (credit/income)
  const isUntrackedExpense = isAccount ? diff < 0 : diff > 0
  const isUntrackedIncome = isAccount ? diff > 0 : diff < 0
  const absDiff = Math.abs(diff)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidNumber) {
      setError(isAccount ? 'Please enter a valid balance' : 'Please enter a valid usage amount (0 or greater)')
      return
    }

    setLoading(true)
    setError('')

    try {
      const url = isAccount
        ? `/api/accounts/${target.id}/reconcile`
        : `/api/credit-cards/${target.id}/reconcile`

      const payload = isAccount
        ? { actualBalance: parsedActual, note: note.trim() || undefined, date: date || undefined }
        : { actualUsed: parsedActual, note: note.trim() || undefined, date: date || undefined }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to reconcile balance')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reconcile balance')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      {/* Current vs Actual Info Box */}
      <div className="rounded-xl border border-border bg-surface-offset/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{isAccount ? 'Currently recorded in app' : 'Current recorded usage'}</span>
          <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">
            {formatCurrency(target.currentValue)}
          </span>
        </div>
      </div>

      {/* Target Real Balance Input */}
      <Input
        id="reconcile-actual-value"
        label={isAccount ? 'Actual Bank / Wallet Balance' : 'Actual Outstanding / Used on Card'}
        type="number"
        step="0.01"
        min={isAccount ? undefined : '0'}
        value={actualValue}
        onChange={e => setActualValue(e.target.value)}
        placeholder="0.00"
        required
      />

      {/* Live Discrepancy Breakdown */}
      {isValidNumber && (
        <div className="overflow-hidden rounded-xl border transition-all text-xs">
          {isZeroDiff ? (
            <div className="flex items-center gap-2.5 bg-success/10 p-3 text-success">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>Balances match! No adjustment transaction will be needed.</span>
            </div>
          ) : isUntrackedExpense ? (
            <div className="flex items-start gap-2.5 bg-danger/10 p-3 text-danger">
              <TrendingDown size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Discrepancy: −{formatCurrency(absDiff)}
                </p>
                <p className="mt-0.5 text-danger/80">
                  {isAccount
                    ? `An untracked expense of ${formatCurrency(absDiff)} will be added to your transaction history so your balance reflects reality.`
                    : `An untracked card expense of ${formatCurrency(absDiff)} will be added to your transaction history to match your card usage.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 bg-success/10 p-3 text-success">
              <TrendingUp size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Discrepancy: +{formatCurrency(absDiff)}
                </p>
                <p className="mt-0.5 text-success/80">
                  {isAccount
                    ? `An untracked income / credit of ${formatCurrency(absDiff)} will be added to your transaction history.`
                    : `A card credit / adjustment of ${formatCurrency(absDiff)} will be recorded in your transaction history.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional Note */}
      <Input
        id="reconcile-note"
        label="Reason / Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={isZeroDiff ? 'Optional note' : 'e.g. Bank statement reconciliation, untracked cash'}
      />

      {/* Date Picker */}
      <DatePicker
        id="reconcile-date"
        label="Adjustment Date"
        value={date}
        onChange={e => setDate(e.target.value)}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger" role="alert">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button id="cancel-reconcile" type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          id="confirm-reconcile"
          type="submit"
          loading={loading}
          disabled={!isValidNumber}
          className="flex-1"
        >
          {isZeroDiff ? 'Confirm Balance' : 'Apply Adjustment'}
        </Button>
      </div>
    </form>
  )
}
