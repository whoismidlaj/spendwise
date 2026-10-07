'use client'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Edit2, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, InlineError, Input, LoadingState, Select, Sheet, SummaryCard } from '@/components/ui'
import { InstitutionLogo } from '@/components/InstitutionLogo'
import { ReconcileForm, ReconcileTarget } from '@/components/ReconcileForm'
import { INSTITUTIONS, InstitutionId, inferInstitution } from '@/lib/institutions'
import { api, errorMessage } from '@/lib/client-api'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface Account { id: string; name: string; type: string; balance: number; color: string; institution: InstitutionId }

const COLORS = ['#01696f', '#006494', '#5f259f', '#dc2626', '#d97706', '#16a34a']
const COLOR_NAMES = ['Teal', 'Blue', 'Purple', 'Red', 'Amber', 'Green']

function AccountForm({ onSuccess, initial }: { onSuccess: () => void; initial?: Account }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? 'BANK')
  const [balance, setBalance] = useState(String(initial?.balance ?? ''))
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [institution, setInstitution] = useState<InstitutionId>(initial?.institution ?? inferInstitution(initial?.name))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      await api(initial ? `/api/accounts/${initial.id}` : '/api/accounts', { method: initial ? 'PATCH' : 'POST', body: { name, type, balance: parseFloat(balance) || 0, color, institution } })
      onSuccess()
    } catch (cause) { setError(errorMessage(cause, 'Unable to save account')) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <Input label="Account name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. HDFC Savings" required />
      <Select label="Type" value={type} onChange={event => setType(event.target.value)}>
        <option value="BANK">Bank account</option><option value="WALLET">Wallet</option><option value="CASH">Cash</option>
      </Select>
      <Select label="Bank / provider" value={institution} onChange={event => setInstitution(event.target.value as InstitutionId)}>
        {Object.entries(INSTITUTIONS).filter(([, item]) => item.account).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </Select>
      {!initial && <Input label="Opening balance" type="number" value={balance} onChange={event => setBalance(event.target.value)} placeholder="0" />}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Colour</legend>
        <div className="flex gap-2">
          {COLORS.map((value, index) => (
            <button key={value} type="button" onClick={() => setColor(value)} aria-label={COLOR_NAMES[index]} aria-pressed={color === value}
              className={cn('h-8 w-8 rounded-full transition-all', color === value && 'ring-2 ring-offset-2 ring-gray-400')} style={{ backgroundColor: value }} />
          ))}
        </div>
      </fieldset>
      <InlineError message={error} />
      <Button type="submit" size="lg" loading={loading}>{initial ? 'Update account' : 'Add account'}</Button>
    </form>
  )
}

export function BankAccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ edit?: Account } | null>(null)
  const [reconcile, setReconcile] = useState<ReconcileTarget | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setAccounts(await api<Account[]>('/api/accounts')); setError('') } catch (cause) { setError(errorMessage(cause, 'Unable to load accounts')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function remove() {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api(`/api/accounts/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); await load() } catch (cause) { setError(errorMessage(cause, 'Unable to delete account')); setDeleting(null) } finally { setBusy(false) }
  }

  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0)
  return (
    <div className="space-y-3">
      <SummaryCard label="Total across bank accounts" value={formatCurrency(total)} detail={`${accounts.length} account${accounts.length === 1 ? '' : 's'} · open an account to adjust its balance`} />
      <Button onClick={() => setSheet({})} variant="outline" className="w-full gap-2"><Plus size={16} aria-hidden /> Add account</Button>
      <InlineError message={error} />
      {loading ? <LoadingState label="Loading accounts…" /> : accounts.length === 0 ? <EmptyState title="No accounts yet" description="Add a bank account, wallet, or cash to track your balance." /> : accounts.map(account => (
        <Card key={account.id} className="overflow-hidden">
          <button type="button" aria-expanded={expanded === account.id} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 p-3.5 text-left" onClick={() => setExpanded(expanded === account.id ? null : account.id)}>
            <InstitutionLogo institution={account.institution} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold dark:text-white min-[390px]:text-base">{account.name}</p>
              <Badge className="mt-0.5 max-w-full truncate bg-surface-offset text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{INSTITUTIONS[account.institution]?.label || account.type}</Badge>
            </div>
            <p className="whitespace-nowrap text-right text-sm font-bold tabular-nums dark:text-white min-[390px]:text-base">{formatCurrency(account.balance)}</p>
            <ChevronDown size={15} aria-hidden className={cn('text-gray-400 transition-transform', expanded === account.id && 'rotate-180')} />
          </button>
          {expanded === account.id && (
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              <Button variant="outline" size="sm" onClick={() => setReconcile({ id: account.id, name: account.name, type: 'account', currentValue: Number(account.balance) })} className="gap-1"><SlidersHorizontal size={13} aria-hidden />Adjust balance</Button>
              <Button variant="outline" size="sm" onClick={() => setSheet({ edit: account })} className="gap-1"><Edit2 size={13} aria-hidden />Edit</Button>
              <Button variant="danger" size="sm" onClick={() => setDeleting(account)} className="gap-1"><Trash2 size={13} aria-hidden />Delete</Button>
            </div>
          )}
        </Card>
      ))}
      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.edit ? 'Edit account' : 'Add account'}>
        {sheet && <AccountForm initial={sheet.edit} onSuccess={() => { setSheet(null); load() }} />}
      </Sheet>
      <Sheet open={Boolean(reconcile)} onClose={() => setReconcile(null)} title={`Adjust ${reconcile?.name ?? ''} balance`}>
        {reconcile && <ReconcileForm target={reconcile} onSuccess={() => { setReconcile(null); load() }} onCancel={() => setReconcile(null)} />}
      </Sheet>
      <ConfirmDialog open={Boolean(deleting)} title="Delete account" destructive confirmLabel="Delete" loading={busy} message={`Delete ${deleting?.name ?? 'this account'}? Its payment history stays in backups.`} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
