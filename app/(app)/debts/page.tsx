'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card, Button, Sheet, Input, Select, FAB, Badge, ProgressBar, DatePicker } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, Calendar, Trash2, Landmark, Coins } from 'lucide-react'

interface DebtPayment {
  id: string
  amount: number
  paidDate: string
  accountId?: string
}

interface Debt {
  id: string
  name: string
  type: 'PERSONAL' | 'LOAN' | 'CREDIT_LINE' | 'PAY_LATER'
  amount: number
  remaining: number
  interestRate: number
  isRecurring: boolean
  paymentDate?: number
  paymentAmount?: number
  deadline?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  description?: string
  payments: DebtPayment[]
}

interface Account {
  id: string
  name: string
}

const TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal Debt',
  LOAN: 'Loan',
  CREDIT_LINE: 'Credit Line',
}

const TYPE_COLORS: Record<string, string> = {
  PERSONAL: '#3b82f6',
  LOAN: '#01696f',
  CREDIT_LINE: '#a855f7',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
}

export default function DebtsPage() {
  const [tab, setTab] = useState<'active' | 'history'>('active')
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)

  // Add Debt Form State
  const [debtForm, setDebtForm] = useState({
    name: '',
    type: 'PERSONAL' as Debt['type'],
    amount: '',
    interestRate: '0',
    isRecurring: false,
    paymentDate: '',
    paymentAmount: '',
    deadline: '',
    priority: 'MEDIUM' as Debt['priority'],
    description: '',
  })

  // Pay Debt Form State
  const [payForm, setPayForm] = useState({
    amount: '',
    accountId: '',
  })

  const [formLoading, setFormLoading] = useState(false)

  async function loadData() {
    try {
      const [debtsRes, accountsRes] = await Promise.all([
        fetch('/api/debts').then((r) => r.json()),
        fetch('/api/accounts').then((r) => r.json()),
      ])
      setDebts(debtsRes)
      setAccounts(accountsRes)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    try {
      const body = {
        name: debtForm.name,
        type: debtForm.type,
        amount: parseFloat(debtForm.amount),
        interestRate: parseFloat(debtForm.interestRate || '0'),
        isRecurring: debtForm.isRecurring,
        paymentDate: debtForm.isRecurring ? parseInt(debtForm.paymentDate) : null,
        paymentAmount: debtForm.isRecurring ? parseFloat(debtForm.paymentAmount) : null,
        deadline: !debtForm.isRecurring && debtForm.deadline ? debtForm.deadline : null,
        priority: debtForm.priority,
        description: debtForm.description || null,
      }

      await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // Reset Form
      setDebtForm({
        name: '',
        type: 'PERSONAL',
        amount: '',
        interestRate: '0',
        isRecurring: false,
        paymentDate: '',
        paymentAmount: '',
        deadline: '',
        priority: 'MEDIUM',
        description: '',
      })
      setAddSheetOpen(false)
      loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setFormLoading(false)
    }
  }

  async function handlePayDebt(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDebt) return
    setFormLoading(true)
    try {
      await fetch(`/api/debts/${selectedDebt.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payForm.amount),
          accountId: payForm.accountId || undefined,
        }),
      })

      setPayForm({ amount: '', accountId: '' })
      setSelectedDebt(null)
      setPaySheetOpen(false)
      loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDeleteDebt(id: string) {
    if (!confirm('Are you sure you want to delete this debt?')) return
    try {
      await fetch(`/api/debts/${id}`, { method: 'DELETE' })
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  // Calculate Metrics
  const totalOutstanding = debts.reduce((sum, d) => sum + Number(d.remaining), 0)

  // Payments made in current calendar month
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const allPayments = debts.flatMap((d) =>
    d.payments.map((p) => ({
      ...p,
      debtName: d.name,
      debtType: d.type,
    }))
  )

  const monthlyExpenditure = allPayments
    .filter((p) => {
      const d = new Date(p.paidDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const upcomingScheduledDues = debts
    .filter((d) => d.isRecurring && d.remaining > 0 && d.paymentAmount)
    .reduce((sum, d) => sum + Number(d.paymentAmount || 0), 0)

  const sortedHistory = allPayments.sort(
    (a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
  )

  return (
    <div className="pb-4">
      {/* Tab Selectors */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors',
              tab === t
                ? 'bg-primary text-white'
                : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            )}
          >
            {t === 'active' ? 'Active Debts' : 'Payment History'}
          </button>
        ))}
      </div>

      {/* Analytics Card */}
      <div className="px-4 mb-4">
        <Card className="p-5 bg-gradient-to-br from-primary to-primary-hover text-white">
          <p className="text-sm text-white/70 mb-1">Total Outstanding Debt</p>
          <p className="text-3xl font-bold tracking-tight mb-4 tabular-nums">
            {formatCurrency(totalOutstanding)}
          </p>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-xs text-white/60 mb-0.5">This Month's Payments</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(monthlyExpenditure)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-0.5">Upcoming Dues (Month)</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(upcomingScheduledDues)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {tab === 'active' ? (
        <div className="px-4 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading debts...</p>
          ) : debts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Landmark className="mx-auto h-12 w-12 text-gray-500 mb-2" />
              <p className="text-lg font-medium">No active debts</p>
              <p className="text-sm">Click + to add a loan, personal debt or credit line.</p>
            </div>
          ) : (
            debts.map((debt) => {
              const paidAmount = Number(debt.amount) - Number(debt.remaining)
              const pct = (paidAmount / Number(debt.amount)) * 100

              return (
                <Card key={debt.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold dark:text-white">{debt.name}</span>
                        <Badge
                          style={{
                            backgroundColor: TYPE_COLORS[debt.type] + '15',
                            color: TYPE_COLORS[debt.type],
                          }}
                        >
                          {TYPE_LABELS[debt.type]}
                        </Badge>
                      </div>
                      {debt.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {debt.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold dark:text-white tabular-nums">
                        {formatCurrency(Number(debt.remaining))}
                      </p>
                      <p className="text-xs text-gray-400">
                        of {formatCurrency(Number(debt.amount))}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: TYPE_COLORS[debt.type] || '#10b981',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{pct.toFixed(0)}% Paid</span>
                      {debt.interestRate > 0 && <span>{debt.interestRate}% Interest</span>}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border dark:border-gray-800">
                    <div className="text-xs text-gray-400 space-y-0.5">
                      {debt.isRecurring ? (
                        <p className="flex items-center gap-1">
                          <Calendar size={13} />
                          EMI: {formatCurrency(Number(debt.paymentAmount || 0))} on {debt.paymentDate}th
                        </p>
                      ) : (
                        <>
                          {debt.deadline && (
                            <p className="flex items-center gap-1">
                              <Calendar size={13} />
                              Payoff by: {new Date(debt.deadline).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                          <p className="flex items-center gap-1">
                            <AlertCircle size={13} />
                            Priority:{' '}
                            <span style={{ color: PRIORITY_COLORS[debt.priority] }}>
                              {debt.priority}
                            </span>
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteDebt(debt.id)}
                        className="text-danger border-danger/30 hover:bg-danger/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDebt(debt)
                          setPayForm({
                            amount: String(debt.isRecurring ? debt.paymentAmount || '' : ''),
                            accountId: '',
                          })
                          setPaySheetOpen(true)
                        }}
                      >
                        Pay
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      ) : (
        <div className="px-4">
          <Card className="divide-y divide-border dark:divide-gray-800">
            {sortedHistory.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">No payment history found</p>
            ) : (
              sortedHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold dark:text-white">{payment.debtName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(payment.paidDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-success tabular-nums">
                    +{formatCurrency(Number(payment.amount))}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {/* Floating Action Button for Add Debt */}
      <FAB onClick={() => setAddSheetOpen(true)} />

      {/* Add Debt Sheet */}
      <Sheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add Debt Details">
        <form onSubmit={handleAddDebt} className="space-y-4 pb-6">
          <Input
            label="Name / Creditor"
            value={debtForm.name}
            onChange={(e) => setDebtForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Personal loan from friend"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={debtForm.type}
              onChange={(e) =>
                setDebtForm((p) => ({ ...p, type: e.target.value as Debt['type'] }))
              }
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>

            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.01"
              value={debtForm.interestRate}
              onChange={(e) => setDebtForm((p) => ({ ...p, interestRate: e.target.value }))}
              placeholder="e.g. 10.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Total Debt Amount"
              type="number"
              value={debtForm.amount}
              onChange={(e) => setDebtForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
            <Select
              label="Priority"
              value={debtForm.priority}
              onChange={(e) =>
                setDebtForm((p) => ({ ...p, priority: e.target.value as Debt['priority'] }))
              }
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="isRecurring"
              checked={debtForm.isRecurring}
              onChange={(e) => setDebtForm((p) => ({ ...p, isRecurring: e.target.checked }))}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              This has recurring/installment payments
            </label>
          </div>

          {debtForm.isRecurring ? (
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-offset dark:bg-gray-800/50 rounded-xl">
              <Input
                label="Monthly Due Day"
                type="number"
                min="1"
                max="31"
                value={debtForm.paymentDate}
                onChange={(e) => setDebtForm((p) => ({ ...p, paymentDate: e.target.value }))}
                placeholder="e.g. 5"
                required
              />
              <Input
                label="Monthly EMI Amount"
                type="number"
                value={debtForm.paymentAmount}
                onChange={(e) => setDebtForm((p) => ({ ...p, paymentAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
          ) : (
            <DatePicker
              label="Payoff Deadline"
              name="deadline"
              value={debtForm.deadline}
              onChange={(e) => setDebtForm((p) => ({ ...p, deadline: e.target.value }))}
            />
          )}

          <Input
            label="Description / Note"
            value={debtForm.description}
            onChange={(e) => setDebtForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional notes"
          />

          <Button type="submit" size="lg" loading={formLoading}>
            Add Debt
          </Button>
        </form>
      </Sheet>

      {/* Pay Debt Sheet */}
      <Sheet
        open={paySheetOpen}
        onClose={() => {
          setSelectedDebt(null)
          setPaySheetOpen(false)
        }}
        title={selectedDebt ? `Record Payment for ${selectedDebt.name}` : 'Record Payment'}
      >
        <form onSubmit={handlePayDebt} className="space-y-4 pb-6">
          <Input
            label="Payment Amount"
            type="number"
            value={payForm.amount}
            onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
            placeholder="0.00"
            required
          />

          <Select
            label="Deduct From Account"
            value={payForm.accountId}
            onChange={(e) => setPayForm((p) => ({ ...p, accountId: e.target.value }))}
          >
            <option value="">None (Outside Wallet / Cash)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>

          <Button type="submit" size="lg" loading={formLoading}>
            Record Payment
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
