'use client'
import { useEffect, useState } from 'react'
import { Card, Button, Input, Sheet } from '@/components/ui'
import { signOut } from 'next-auth/react'
import { User, Lock, Globe, Trash2, Database, AlertTriangle, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserProfile { id: string; name: string; email: string; currency: string; cashBuffer: number }

const CURRENCIES = [
  { value: 'INR', label: '₹ Indian Rupee' },
  { value: 'USD', label: '$ US Dollar' },
  { value: 'EUR', label: '€ Euro' },
  { value: 'GBP', label: '£ British Pound' },
  { value: 'AED', label: 'د.إ UAE Dirham' },
  { value: 'SGD', label: 'S$ Singapore Dollar' },
]

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
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, currency: form.currency, cashBuffer: Number(form.cashBuffer || 0) }) })
    setMsg('Profile saved!'); setLoading(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwMsg('')
    if (pwForm.new !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    setPwLoading(true)
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }) })
    const data = await res.json()
    setPwMsg(res.ok ? 'Password changed!' : data.error || 'Error'); setPwLoading(false)
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreMsg('')
    
    if (!confirm('Restoring this backup will replace your current Spendwise data. Do you want to continue?')) {
      e.target.value = ''
      return
    }

    setRestoring(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok) {
        setRestoreMsg('Backup restored successfully!')
        load()
      } else {
        setRestoreMsg(result.error || 'Restore failed')
      }
    } catch (err: any) {
      setRestoreMsg('Invalid backup file format')
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
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
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"><Globe size={12} className="inline mr-1" />Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30">
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
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
    </div>
  )
}
