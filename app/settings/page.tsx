'use client'
import { SUPPORTED_CURRENCIES, setActiveCurrency } from '@/lib/currency'
import { useEffect, useState } from 'react'
import { Card, Button, ConfirmDialog, Input, Select, Sheet } from '@/components/ui'
import { signOut } from 'next-auth/react'
import { User, Lock, Trash2, Database, AlertTriangle, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserProfile { id: string; name: string; email: string; currency: string; cashBuffer: number }

const CURRENCIES = SUPPORTED_CURRENCIES

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState({ name: '', email: '', currency: 'INR', cashBuffer: '' })
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState('')
  const [pendingRestore, setPendingRestore] = useState<{ data: unknown; preview: { version: string; counts: Record<string, number>; warnings: string[]; notes: string[]; replaces: Record<string, number> } } | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearMsg, setClearMsg] = useState('')

  async function load() {
    const user = await fetch('/api/settings').then(r => r.json())
    setProfile(user)
    setForm({ name: user.name ?? '', email: user.email ?? '', currency: user.currency ?? 'INR', cashBuffer: String(user.cashBuffer ?? 0) })
  }

  useEffect(() => { load() }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('')
    try {
      const response = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, currency: form.currency, cashBuffer: Number(form.cashBuffer || 0) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save profile')
      setActiveCurrency(data.currency)
      setMsg('Profile saved!')
    } catch (cause) { setMsg(cause instanceof Error ? cause.message : 'Unable to save profile') } finally { setLoading(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwMsg('')
    if (pwForm.new !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    setPwLoading(true)
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }) })
    const data = await res.json()
    setPwMsg(res.ok ? 'Password changed!' : data.error || 'Error'); setPwLoading(false)
  }

  // Step 1: validate the file and show what it contains. Nothing changes until the user confirms.
  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setRestoreMsg(''); setRestoring(true)
    try {
      const text = await file.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { throw new Error('The file is not valid JSON, or it was cut off before the end') }
      const res = await fetch('/api/restore?preview=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await res.json()
      if (!res.ok) throw new Error([result.error, ...(result.details ?? [])].filter(Boolean).join(' · ') || 'Restore failed')
      setPendingRestore({ data, preview: result })
    } catch (err) {
      setRestoreMsg(err instanceof Error ? err.message : 'Invalid backup file format')
    } finally { setRestoring(false) }
  }

  // Step 2: replace the data atomically and report exactly what was imported.
  async function confirmRestore() {
    if (!pendingRestore) return
    setRestoring(true); setRestoreMsg('')
    try {
      const res = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingRestore.data) })
      const result = await res.json()
      if (!res.ok) throw new Error([result.error, ...(result.details ?? [])].filter(Boolean).join(' · ') || 'Restore failed')
      const r = result.restored
      setRestoreMsg(`Backup restored successfully: ${r.accounts} accounts, ${r.creditCards} cards, ${r.debts} loans/debts (${r.debtPayments} payments), ${r.paymentPlans} recurring payments, ${r.incomeSources} income sources.${result.notes?.length ? ` ${result.notes.join(' ')}` : ''}`)
      setPendingRestore(null)
      await load()
    } catch (err) {
      setRestoreMsg(err instanceof Error ? err.message : 'Restore failed')
      setPendingRestore(null)
    } finally { setRestoring(false) }
  }

  async function handleClearData() {
    setClearing(true)
    setClearMsg('')
    try {
      const res = await fetch('/api/settings/clear-data', {
        method: 'POST',
      })
      const result = await res.json()
      if (res.ok) {
        setClearMsg('All financial data cleared successfully!')
        setShowClearModal(false)
        setConfirmText('')
        load()
      } else {
        setClearMsg(result.error || 'Failed to clear data')
      }
    } catch (err: any) {
      setClearMsg('Network error while clearing data')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-3 py-3 pb-8 sm:space-y-4 sm:px-4 sm:py-4">
      {/* Profile */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-primary" />
          <h2 className="font-semibold dark:text-white">Profile</h2>
        </div>
        <form onSubmit={saveProfile} className="space-y-3">
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Select label="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input id="cash-buffer" label="Safety buffer" type="number" min="0" step="0.01" value={form.cashBuffer} onChange={e => setForm(f => ({ ...f, cashBuffer: e.target.value }))} />
          <p className="text-xs text-gray-500">The payment plan keeps this amount aside before showing money as safe to spend.</p>
          {msg && <p className="text-xs text-success">{msg}</p>}
          <Button type="submit" loading={loading}>Save Profile</Button>
        </form>
      </Card>

      {/* Password */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-primary" />
          <h2 className="font-semibold dark:text-white">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <Input label="Current Password" type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
          <Input label="New Password" type="password" value={pwForm.new} onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))} />
          <Input label="Confirm Password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          {pwMsg && <p className={`text-xs ${pwMsg.includes('!') ? 'text-success' : 'text-danger'}`}>{pwMsg}</p>}
          <Button type="submit" loading={pwLoading}>Change Password</Button>
        </form>
      </Card>

      {/* Backup & Restore */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-primary" />
          <h2 className="font-semibold dark:text-white">Backup & Restore</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Download one JSON backup of your Spendwise data, or restore from a previous backup.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/api/backup"
            download
            className="inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all min-h-[44px] px-4 py-2.5 text-sm bg-primary hover:bg-primary-hover text-white text-center"
          >
            <Download size={16} /> Download Backup (JSON)
          </a>
          
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleRestore}
              className="hidden"
              id="restore-file"
              disabled={restoring}
            />
            <label
              htmlFor="restore-file"
              className={cn(
                "inline-flex items-center justify-center font-medium rounded-xl transition-all min-h-[44px] px-4 py-2.5 text-sm border border-dashed border-border dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-surface-offset dark:hover:bg-gray-800 w-full cursor-pointer text-center",
                restoring && "opacity-50 pointer-events-none"
              )}
            >
              <Upload size={16} className="mr-2" />
              {restoring ? 'Restoring...' : 'Restore Backup (JSON)'}
            </label>
          </div>
          {restoreMsg && (
            <p className={cn("text-xs text-center mt-1", restoreMsg.includes('successfully') ? "text-success" : "text-danger")}>
              {restoreMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-4 border-danger/30">
        <h2 className="font-semibold text-danger mb-3">Danger Zone</h2>
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-danger flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-danger">Clear All Data</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Permanently delete all accounts, cards, bills, income, loans, debts, lending, and their payment history.
                </p>
                {clearMsg && (
                  <p className={cn("text-xs font-medium mt-2", clearMsg.includes('successfully') ? "text-success" : "text-danger")}>
                    {clearMsg}
                  </p>
                )}
                <div className="mt-3">
                  <Button
                    id="clear-data-btn"
                    variant="danger"
                    size="sm"
                    loading={clearing}
                    onClick={() => {
                      setClearMsg('')
                      setConfirmText('')
                      setShowClearModal(true)
                    }}
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Clear Data
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border dark:border-gray-800 flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sign out of your account</span>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              Sign Out
            </Button>
          </div>
        </div>
      </Card>

      {/* Clear Data Confirmation Sheet Modal */}
      <Sheet
        open={showClearModal}
        onClose={() => {
          if (!clearing) {
            setShowClearModal(false)
            setConfirmText('')
          }
        }}
        title="Clear All Financial Data"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/50 flex items-start gap-3">
            <AlertTriangle className="text-danger flex-shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-red-900 dark:text-red-200 space-y-1">
              <p className="font-semibold text-sm text-danger">Warning: This action is irreversible!</p>
              <p>This will permanently erase all your:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1 text-gray-700 dark:text-gray-300">
                <li>Bank, Wallet & Cash Accounts</li>
                <li>Credit Cards & Pay Later Accounts</li>
                <li>Recurring bills and their payment history</li>
                <li>Loans, EMIs, debts, and lending</li>
                <li>Income and salary plans</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Type <strong className="text-danger font-bold">DELETE</strong> to confirm:
            </label>
            <Input
              id="confirm-delete-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="text-sm font-mono"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              id="cancel-clear-btn"
              variant="outline"
              className="flex-1"
              disabled={clearing}
              onClick={() => {
                setShowClearModal(false)
                setConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button
              id="confirm-clear-btn"
              variant="danger"
              className="flex-1"
              loading={clearing}
              disabled={confirmText !== 'DELETE'}
              onClick={handleClearData}
            >
              <Trash2 size={15} className="mr-1.5" />
              Clear Everything
            </Button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog
        open={Boolean(pendingRestore)} title="Replace your data with this backup?" confirmLabel="Replace my data" destructive loading={restoring}
        onCancel={() => setPendingRestore(null)} onConfirm={confirmRestore}
        message={pendingRestore && <div className="space-y-3">
          <p>Backup version {pendingRestore.preview.version}. Restoring replaces everything currently in your account.</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-surface-offset p-3 text-xs dark:bg-gray-800">
            {([['accounts', 'Accounts'], ['creditCards', 'Cards'], ['debts', 'Loans & debts'], ['debtPayments', 'Loan payments'], ['paymentPlans', 'Recurring payments'], ['incomeSources', 'Income sources'], ['ledgerEntries', 'Ledger entries']] as const).map(([key, label]) => <div key={key} className="flex justify-between gap-2"><dt>{label}</dt><dd className="font-semibold tabular-nums">{pendingRestore.preview.counts[key] ?? 0}</dd></div>)}
          </dl>
          {pendingRestore.preview.warnings.map(warning => <p key={warning} className="text-xs text-warning">{warning}</p>)}
          {pendingRestore.preview.notes.map(note => <p key={note} className="text-xs text-gray-500">{note}</p>)}
        </div>}
      />
    </div>
  )
}
