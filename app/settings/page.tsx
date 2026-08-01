'use client'
import { useEffect, useState } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { signOut } from 'next-auth/react'
import { User, Lock, Globe, Tag, Trash2, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserProfile { id: string; name: string; email: string; currency: string }
interface Category { id: string; name: string; icon: string; color: string; type: string; isSystem: boolean }

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
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ name: '', email: '', currency: 'INR' })
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [catForm, setCatForm] = useState({ name: '', icon: '📌', color: '#6b7280', type: 'EXPENSE' })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  async function load() {
    const [user, cats] = await Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ])
    setProfile(user)
    setForm({ name: user.name ?? '', email: user.email ?? '', currency: user.currency ?? 'INR' })
    setCategories(cats)
  }

  useEffect(() => { load() }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('')
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, currency: form.currency }) })
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

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    setCatForm({ name: '', icon: '📌', color: '#6b7280', type: 'EXPENSE' }); load()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return
    await fetch(`/api/categories?id=${id}`, { method: 'DELETE' }); load()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg('')
    
    if (!confirm('Importing data will OVERWRITE all your existing transactions, accounts, credit cards, and categories. Do you want to proceed?')) {
      e.target.value = ''
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok) {
        setImportMsg('Data imported successfully!')
        load()
      } else {
        setImportMsg(result.error || 'Import failed')
      }
    } catch (err: any) {
      setImportMsg('Invalid backup file format')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-8">
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

      {/* Categories */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={16} className="text-primary" />
          <h2 className="font-semibold dark:text-white">Categories</h2>
        </div>
        <form onSubmit={addCategory} className="space-y-3 mb-4 p-3 bg-surface-offset dark:bg-gray-800 rounded-xl">
          <h3 className="text-sm font-medium dark:text-gray-300">Add Category</h3>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
            <Input placeholder="Icon (emoji)" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Color</label>
              <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} className="h-10 w-full rounded-xl border border-border cursor-pointer" />
            </div>
            <select value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}
              className="px-3 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white text-sm">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>
          <Button type="submit" size="sm">Add Category</Button>
        </form>
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 py-2">
              <span className="text-xl w-8 text-center">{cat.icon}</span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm dark:text-gray-300">{cat.name}</span>
              <span className="text-xs text-gray-400">{cat.type}</span>
              {!cat.isSystem && (
                <button onClick={() => deleteCategory(cat.id)} className="p-1.5 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                  <Trash2 size={13} className="text-danger" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Backup & Restore */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-primary" />
          <h2 className="font-semibold dark:text-white">Backup & Restore</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Export your accounts, credit cards, transactions, and categories to a JSON backup file, or restore from a previous backup.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/api/export"
            download
            className="inline-flex items-center justify-center font-medium rounded-xl transition-all min-h-[44px] px-4 py-2.5 text-sm bg-primary hover:bg-primary-hover text-white text-center"
          >
            Export Data (JSON)
          </a>
          
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
              disabled={importing}
            />
            <label
              htmlFor="import-file"
              className={cn(
                "inline-flex items-center justify-center font-medium rounded-xl transition-all min-h-[44px] px-4 py-2.5 text-sm border border-border dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-surface-offset dark:hover:bg-gray-800 w-full cursor-pointer text-center",
                importing && "opacity-50 pointer-events-none"
              )}
            >
              {importing ? 'Importing...' : 'Import Backup (JSON)'}
            </label>
          </div>
          {importMsg && (
            <p className={cn("text-xs text-center mt-1", importMsg.includes('successfully') ? "text-success" : "text-danger")}>
              {importMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-4 border-danger/30">
        <h2 className="font-semibold text-danger mb-3">Danger Zone</h2>
        <Button variant="danger" onClick={() => signOut({ callbackUrl: '/login' })}>Sign Out</Button>
      </Card>
    </div>
  )
}
