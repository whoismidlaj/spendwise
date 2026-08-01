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

export function TransactionForm({ onSuccess, initial }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [cards, setCards] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string; type: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [useCard, setUseCard] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initial?.type ?? 'EXPENSE',
      amount: initial?.amount ?? '',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      accountId: initial?.accountId ?? '',
      toAccountId: initial?.toAccountId ?? '',
      categoryId: initial?.categoryId ?? '',
    },
  })

  const type = watch('type')

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/credit-cards').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([accs, ccs, cats]) => {
      setAccounts(accs)
      setCards(ccs)
      setCategories(cats)
    })
  }, [])

  const filteredCategories = categories.filter(c =>
    type === 'TRANSFER' ? true : c.type === type
  )

  async function onSubmit(data: FormData) {
    setLoading(true)
    const payload = {
      ...data,
      amount: parseFloat(data.amount),
      accountId: type === 'TRANSFER' ? (data.accountId || undefined) : (useCard ? undefined : (data.accountId || undefined)),
      toAccountId: type === 'TRANSFER' ? (data.toAccountId || undefined) : undefined,
      creditCardId: type === 'TRANSFER' ? undefined : (useCard ? (data.creditCardId || undefined) : undefined),
      categoryId: data.categoryId || undefined,
    }

    const url = initial?.id ? `/api/transactions/${initial.id}` : '/api/transactions'
    const method = initial?.id ? 'PATCH' : 'POST'

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setLoading(false)
    onSuccess()
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
      <DatePicker label="Date" error={errors.date?.message} {...register('date')} />

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
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setUseCard(false)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', !useCard ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
              Account
            </button>
            <button type="button" onClick={() => setUseCard(true)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', useCard ? 'bg-primary text-white' : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
              Credit Card
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
