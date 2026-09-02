'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Select, DatePicker } from '@/components/ui'
import { cn } from '@/lib/utils'

const schema = z.object({
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  amount: z.string().min(1, 'Amount required'),
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  date: z.string().min(1),
  time: z.string().optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  categoryId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TransactionFormProps {
  onSuccess: () => void
  initial?: Partial<FormData> & { id?: string }
}

function getCurrentTimeStr(dateObj?: Date) {
  const d = dateObj || new Date()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${mins}`
}

export function TransactionForm({ onSuccess, initial }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [cards, setCards] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string; type: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [useCard, setUseCard] = useState(Boolean(initial?.creditCardId))

  const initialDateObj = initial?.date ? new Date(initial.date) : new Date()
  const initialDateStr = initial?.date
    ? (initial.date.includes('T') ? initial.date.slice(0, 10) : initial.date)
    : new Date().toISOString().slice(0, 10)
  const initialTimeStr = initial?.time || (initial?.date && initial.date.includes('T') ? getCurrentTimeStr(initialDateObj) : getCurrentTimeStr())

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initial?.type ?? 'EXPENSE',
      amount: initial?.amount ?? '',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      date: initialDateStr,
      time: initialTimeStr,
      accountId: initial?.accountId ?? '',
      toAccountId: initial?.toAccountId ?? '',
      creditCardId: initial?.creditCardId ?? '',
      categoryId: initial?.categoryId ?? '',
    },
  })

  const type = watch('type')
  const selectedAccountId = watch('accountId')
  const selectedCreditCardId = watch('creditCardId')

  // Load accounts, cards, categories and apply defaults
  useEffect(() => {
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/credit-cards').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([accs, ccs, cats]) => {
      setAccounts(accs || [])
      setCards(ccs || [])
      setCategories(cats || [])

      // If adding a new transaction (not editing existing)
      if (!initial?.id) {
        // Check for user-defined default payment method
        try {
          const storedDefault = localStorage.getItem('spendwise_default_payment_method')
          if (storedDefault) {
            const def = JSON.parse(storedDefault)
            if (def.type === 'CARD' && def.id && (ccs || []).some((c: any) => c.id === def.id)) {
              setUseCard(true)
              setValue('creditCardId', def.id)
              return
            } else if (def.type === 'ACCOUNT' && def.id && (accs || []).some((a: any) => a.id === def.id)) {
              setUseCard(false)
              setValue('accountId', def.id)
              return
            }
          }
        } catch (e) {
          console.error(e)
        }

        // Fallback default: select first bank account if available
        if (accs && accs.length > 0 && !selectedAccountId) {
          setValue('accountId', accs[0].id)
        }
      } else {
        // If editing existing transaction
        if (initial.creditCardId) {
          setUseCard(true)
          setValue('creditCardId', initial.creditCardId)
        } else if (initial.accountId) {
          setUseCard(false)
          setValue('accountId', initial.accountId)
        }
      }
    })
  }, [initial, setValue])

  const filteredCategories = categories.filter(c =>
    type === 'TRANSFER' ? true : c.type === type
  )

  async function onSubmit(data: FormData) {
    setLoading(true)
    
    // Combine date and time
    let combinedDateTime = data.date
    if (data.time) {
      const [hours, mins] = data.time.split(':')
      const d = new Date(data.date)
      d.setHours(parseInt(hours || '0', 10), parseInt(mins || '0', 10), 0, 0)
      combinedDateTime = d.toISOString()
    } else {
      combinedDateTime = new Date(data.date).toISOString()
    }

    const payload = {
      type: data.type,
      amount: parseFloat(data.amount),
      name: data.name,
      description: data.description || null,
      date: combinedDateTime,
      accountId: data.type === 'TRANSFER'
        ? (data.accountId || null)
        : (useCard ? null : (data.accountId || null)),
      toAccountId: data.type === 'TRANSFER'
        ? (data.toAccountId || null)
        : null,
      creditCardId: data.type === 'TRANSFER'
        ? null
        : (useCard ? (data.creditCardId || null) : null),
      categoryId: data.categoryId || null,
    }

    const url = initial?.id ? `/api/transactions/${initial.id}` : '/api/transactions'
    const method = initial?.id ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        const errMsg = typeof err.error === 'string'
          ? err.error
          : (err.error?.issues?.[0]?.message || err.error?.message || err.message || 'Failed to save transaction')
        alert(errMsg)
      } else {
        onSuccess()
      }
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
      {/* Type Tabs */}
      <div className="flex rounded-xl border border-border dark:border-gray-700 overflow-hidden">
        {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setValue('type', t)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              type === t
                ? 'bg-primary text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-surface-offset dark:hover:bg-gray-800'
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 block w-full text-3xl font-bold px-3 py-3 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary tabular-nums"
          {...register('amount')}
        />
        {errors.amount && <p className="text-xs text-danger mt-1">{errors.amount.message}</p>}
      </div>

      <Input label="Name" placeholder="e.g., Swiggy order" error={errors.name?.message} {...register('name')} />
      <Input label="Description (optional)" placeholder="Notes..." {...register('description')} />
      
      <div className="grid grid-cols-3 gap-2 items-start">
        <div className="col-span-2">
          <DatePicker label="Date" error={errors.date?.message} {...register('date')} />
        </div>
        <div>
          <Input
            label="Time"
            type="time"
            error={errors.time?.message}
            {...register('time')}
          />
        </div>
      </div>

      {/* Category Grid */}
      {filteredCategories.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {filteredCategories.map(cat => {
              const selected = watch('categoryId') === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setValue('categoryId', cat.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all',
                    selected
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-border dark:border-gray-700 hover:bg-surface-offset dark:hover:bg-gray-800'
                  )}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-[10px] text-center leading-tight dark:text-gray-300">{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Account / Card toggle */}
      {type !== 'TRANSFER' && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
            Payment Source
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setUseCard(false)
                if (!watch('accountId') && accounts.length > 0) {
                  setValue('accountId', accounts[0].id)
                }
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                !useCard ? 'bg-primary text-white shadow-xs' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              )}
            >
              Bank / Cash Account
            </button>
            <button
              type="button"
              onClick={() => {
                setUseCard(true)
                if (!watch('creditCardId') && cards.length > 0) {
                  setValue('creditCardId', cards[0].id)
                }
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                useCard ? 'bg-primary text-white shadow-xs' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              )}
            >
              Credit Card / Pay Later
            </button>
          </div>
          {!useCard ? (
            <Select {...register('accountId')}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          ) : (
            <Select {...register('creditCardId')}>
              <option value="">Select card</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </div>
      )}

      {type === 'TRANSFER' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">From Account</label>
            <Select {...register('accountId')}>
              <option value="">Select source account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">To Account</label>
            <Select {...register('toAccountId')}>
              <option value="">Select destination account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </div>
      )}

      <Button type="submit" size="lg" loading={loading}>
        {initial?.id ? 'Update Transaction' : 'Add Transaction'}
      </Button>
    </form>
  )
}
