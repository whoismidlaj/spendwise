'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, remainingPrincipal } from '@/lib/currency'
import { buildLoanSchedule } from '@/lib/loan-schedule'
import { Card, Button, Sheet, Input, Select, FAB, Badge, ProgressBar, DatePicker } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, Calendar, Trash2, Landmark, Coins, Edit2, CreditCard, RefreshCw, Download } from 'lucide-react'
import { ExportLiabilitiesModal, ExportScope } from '@/components/ExportLiabilitiesModal'

interface DebtPayment {
  id: string
  amount: number
  paidDate: string
  accountId?: string
}

interface Debt {
  direction: 'BORROWED' | 'LENT'
  isActive: boolean
  id: string
  name: string
  type: 'PERSONAL' | 'LOAN' | 'CREDIT_LINE' | 'PAY_LATER'
  amount: number
  remaining: number
  interestRate: number
  isRecurring: boolean
  paymentDate?: number
  paymentAmount?: number
  totalInstallments?: number
  startDate?: string
  deadline?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  description?: string
  payments: DebtPayment[]
}

interface CreditCardItem {
  id: string
  name: string
  bank: string
  type: 'CREDIT' | 'PAYLATER'
  totalLimit: number
  usedLimit: number
  dueAmount: number
  minimumDue: number
  dueDate: number
}

interface RecurringItem {
  id: string
  name: string
  type: string
  loanAmount?: number
  interestRate?: number
  emiAmount: number
  emiDate: number
  totalEMIs?: number
  paidEMIs: number
  isActive: boolean
}

interface UpcomingItem {
  id: string
  sourceId: string
  name: string
  source: 'CREDIT_CARD' | 'RECURRING' | 'DEBT'
  typeLabel: string
  amount: number
  dueDate: string
  dueDay: number
  daysLeft: number
  isOverdue: boolean
  color?: string
  bank?: string
  accountName?: string
  accountId?: string
  minimumAmount?: number
  remainingTotal?: number
  paidCount?: number
  totalCount?: number
}

interface UpcomingSummary {
  total: number
  creditCards: number
  recurring: number
  debts: number
  totalCount: number
  overdueCount: number
}

interface Account {
  id: string
  name: string
}

const TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal Debt',
  LOAN: 'Loan',
  CREDIT_LINE: 'Credit Line',
  PAY_LATER: 'Pay Later',
}

const TYPE_COLORS: Record<string, string> = {
  PERSONAL: '#3b82f6',
  LOAN: '#01696f',
  CREDIT_LINE: '#a855f7',
  PAY_LATER: '#f97316',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
}

function LoanScheduleSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const schedule = buildLoanSchedule(Number(debt.amount), Number(debt.interestRate || 0), Number(debt.paymentAmount), Number(debt.totalInstallments), debt.startDate!, debt.paymentDate)
  const paidTotal = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  return <Sheet open onClose={onClose} title={`${debt.name} installment plan`}>
    <div className="space-y-4 pb-4">
      <Card className="p-4"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] text-gray-500">Original</p><p className="font-bold">{formatCurrency(debt.amount)}</p></div><div><p className="text-[10px] text-gray-500">Paid so far</p><p className="font-bold text-success">{formatCurrency(paidTotal)}</p></div><div><p className="text-[10px] text-gray-500">Remaining</p><p className="font-bold text-danger">{formatCurrency(debt.remaining)}</p></div></div></Card>
      <p className="text-xs text-gray-500">Estimated amortization from the principal, annual rate and EMI. Recorded payments show your actual payment progress.</p>
      <Card className="overflow-hidden divide-y divide-border dark:divide-gray-800">{schedule.map((item, index) => { const paid = [...debt.payments].sort((a, b) => new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime())[index]; return <div key={item.number} className="grid grid-cols-[28px_1fr_auto] gap-2 p-3 text-xs"><span className="font-bold text-primary">{item.number}</span><div><p className="font-semibold">{item.dueDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p><p className="text-gray-500">Principal {formatCurrency(item.principal)} · Interest {formatCurrency(item.interest)}</p></div><div className="text-right"><p className="font-bold">{formatCurrency(item.emi)}</p><p className={paid ? 'text-success' : 'text-gray-400'}>{paid ? `Paid ${formatCurrency(paid.amount)}` : `Balance ${formatCurrency(item.closing)}`}</p></div></div> })}</Card>
    </div>
  </Sheet>
}

export default function DebtsPage() {
  const [tab, setTab] = useState<'active' | 'upcoming' | 'history'>('active')
  const [debts, setDebts] = useState<Debt[]>([])
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>([])
  const [recurringList, setRecurringList] = useState<RecurringItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // Sheets & Modals
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [scheduleDebt, setScheduleDebt] = useState<Debt | null>(null)

  // Filter & Sort States for Debts
  const [directionFilter, setDirectionFilter] = useState<'ALL' | Debt['direction']>('ALL')
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | Debt['type']>('ALL')
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'amount' | 'created'>('priority')

  // Add Debt Form State
  const [debtForm, setDebtForm] = useState({
    name: '',
    direction: 'BORROWED' as Debt['direction'],
    type: 'PERSONAL' as Debt['type'],
    amount: '',
    remaining: '',
    interestRate: '0',
    isRecurring: false,
    paymentDate: '',
    paymentAmount: '',
    totalInstallments: '',
    startDate: new Date().toISOString().slice(0, 10),
    deadline: '',
    priority: 'MEDIUM' as Debt['priority'],
    description: '',
  })

  // Edit Debt Form State
  const [editForm, setEditForm] = useState({
    name: '',
    direction: 'BORROWED' as Debt['direction'],
    type: 'PERSONAL' as Debt['type'],
    amount: '',
    remaining: '',
    interestRate: '0',
    isRecurring: false,
    paymentDate: '',
    paymentAmount: '',
    totalInstallments: '',
    startDate: '',
    deadline: '',
    priority: 'MEDIUM' as Debt['priority'],
    description: '',
  })

  // Debt Pay Form State
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))

  // Upcoming Dues States
  const [upcomingTimeframe, setUpcomingTimeframe] = useState<'thisMonth' | 'next7Days' | 'next30Days' | 'nextMonth' | 'custom'>('thisMonth')
  const [customRange, setCustomRange] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  })
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([])
  const [upcomingSummary, setUpcomingSummary] = useState<UpcomingSummary>({
    total: 0, creditCards: 0, recurring: 0, debts: 0, totalCount: 0, overdueCount: 0,
  })
  const [upcomingFilter, setUpcomingFilter] = useState<'ALL' | 'CREDIT_CARD' | 'RECURRING' | 'DEBT'>('ALL')
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  // Quick Pay Modal for Upcoming Dues
  const [payModalItem, setPayModalItem] = useState<UpcomingItem | null>(null)
  const [payModalAmount, setPayModalAmount] = useState('')
  const [payModalAccountId, setPayModalAccountId] = useState('')
  const [payModalLoading, setPayModalLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [debtsRes, accsRes, cardsRes, recRes] = await Promise.all([
        fetch('/api/debts').then((r) => r.json()),
        fetch('/api/accounts').then((r) => r.json()),
        fetch('/api/credit-cards').then((r) => r.json()),
        fetch('/api/recurring').then((r) => r.json()),
      ])
      setDebts(debtsRes || [])
      setAccounts(accsRes || [])
      setCreditCards(cardsRes || [])
      setRecurringList(recRes || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save changes')
    } finally {
      setLoading(false)
    }
  }, [])

  function getUpcomingDates(tf: typeof upcomingTimeframe) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    
    if (tf === 'thisMonth') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      }
    }
    if (tf === 'next7Days') {
      const end = new Date(today)
      end.setDate(end.getDate() + 7)
      end.setHours(23, 59, 59, 999)
      return { start: today, end }
    }
    if (tf === 'next30Days') {
      const end = new Date(today)
      end.setDate(end.getDate() + 30)
      end.setHours(23, 59, 59, 999)
      return { start: today, end }
    }
    if (tf === 'nextMonth') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
      }
    }
    return {
      start: new Date(`${customRange.startDate}T00:00:00`),
      end: new Date(`${customRange.endDate}T23:59:59`),
    }
  }

  const loadUpcoming = useCallback(async () => {
    setUpcomingLoading(true)
    try {
      const { start, end } = getUpcomingDates(upcomingTimeframe)
      const res = await fetch(`/api/expenses/upcoming?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).then(r => r.json())
      setUpcomingItems(res.items || [])
      setUpcomingSummary(res.summary || {
        total: 0, creditCards: 0, recurring: 0, debts: 0, totalCount: 0, overdueCount: 0,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setUpcomingLoading(false)
    }
  }, [upcomingTimeframe, customRange.startDate, customRange.endDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (tab === 'upcoming') {
      loadUpcoming()
    }
  }, [tab, loadUpcoming])

  // AGGREGATED DEBT CALCULATIONS
  const activeDebts = debts.filter(d => d.isActive && Number(d.remaining) > 0)
  const lentTotal = activeDebts.filter(d => d.direction === 'LENT').reduce((sum, d) => sum + Number(d.remaining), 0)
  const personalDebtsTotal = activeDebts.filter(d => d.direction !== 'LENT').reduce((sum, d) => sum + Number(d.remaining || 0), 0)
  
  const creditCardsTotal = creditCards.reduce((sum, c) => {
    const used = Number(c.usedLimit || 0)
    const due = Number(c.dueAmount || 0)
    return sum + (used > 0 ? used : due)
  }, 0)

  const loansRemainingTotal = recurringList
    .filter(r => (r.type === 'EMI' || r.type === 'LOAN') && r.loanAmount && r.totalEMIs)
    .reduce((sum, r) => {
      const rem = remainingPrincipal(r.loanAmount!, r.interestRate ?? 0, r.totalEMIs!, r.paidEMIs)
      return sum + (rem || 0)
    }, 0)

  const totalAggregatedDebt = personalDebtsTotal + creditCardsTotal + loansRemainingTotal

  async function saveRequest(url: string, options: RequestInit) {
    setError('')
    const response = await fetch(url, options)
    if (!response.ok) throw new Error((await response.json()).error || 'Unable to save changes')
    return response
  }

  // Handlers for Debts
  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: any = {
        name: debtForm.name,
        direction: debtForm.direction,
        type: debtForm.type,
        amount: parseFloat(debtForm.amount),
        interestRate: parseFloat(debtForm.interestRate) || 0,
        isRecurring: debtForm.isRecurring,
        priority: debtForm.priority,
        description: debtForm.description || undefined,
      }
      if (debtForm.isRecurring) {
        payload.paymentDate = parseInt(debtForm.paymentDate, 10)
        payload.paymentAmount = parseFloat(debtForm.paymentAmount)
        if (debtForm.type === 'LOAN') {
          payload.totalInstallments = parseInt(debtForm.totalInstallments, 10)
          payload.startDate = debtForm.startDate
        }
      } else if (debtForm.deadline) {
        payload.deadline = debtForm.deadline
      }

      await saveRequest('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setAddSheetOpen(false)
      setDebtForm({
        name: '',
        direction: 'BORROWED',
        type: 'PERSONAL',
        amount: '',
        remaining: '',
        interestRate: '0',
        isRecurring: false,
        paymentDate: '',
        paymentAmount: '',
        totalInstallments: '',
        startDate: new Date().toISOString().slice(0, 10),
        deadline: '',
        priority: 'MEDIUM',
        description: '',
      })
      loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save changes')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenEdit(debt: Debt) {
    setEditingDebt(debt)
    setEditForm({
      name: debt.name,
      direction: debt.direction,
      type: debt.type,
      amount: String(debt.amount),
      remaining: String(debt.remaining),
      interestRate: String(debt.interestRate ?? 0),
      isRecurring: debt.isRecurring,
      paymentDate: debt.paymentDate ? String(debt.paymentDate) : '',
      paymentAmount: debt.paymentAmount ? String(debt.paymentAmount) : '',
      totalInstallments: debt.totalInstallments ? String(debt.totalInstallments) : '',
      startDate: debt.startDate ? debt.startDate.slice(0, 10) : '',
      deadline: debt.deadline ? debt.deadline.slice(0, 10) : '',
      priority: debt.priority,
      description: debt.description || '',
    })
    setEditSheetOpen(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDebt) return
    setLoading(true)
    try {
      const payload: any = {
        name: editForm.name,
        direction: editForm.direction,
        type: editForm.type,
        amount: parseFloat(editForm.amount),
        remaining: parseFloat(editForm.remaining),
        interestRate: parseFloat(editForm.interestRate) || 0,
        isRecurring: editForm.isRecurring,
        priority: editForm.priority,
        description: editForm.description || null,
        deadline: editForm.deadline ? editForm.deadline : null,
      }
      if (editForm.isRecurring) {
        payload.paymentDate = parseInt(editForm.paymentDate, 10)
        payload.paymentAmount = parseFloat(editForm.paymentAmount)
        payload.totalInstallments = editForm.type === 'LOAN' && editForm.totalInstallments ? parseInt(editForm.totalInstallments, 10) : null
        payload.startDate = editForm.type === 'LOAN' && editForm.startDate ? editForm.startDate : null
      } else {
        payload.paymentDate = null
        payload.paymentAmount = null
        payload.totalInstallments = null
        payload.startDate = null
      }

      await saveRequest(`/api/debts/${editingDebt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setEditSheetOpen(false)
      setEditingDebt(null)
      loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save changes')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDebt) return
    setLoading(true)
    try {
      await saveRequest(`/api/debts/${selectedDebt.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paidDate: paymentDate,
          accountId: paymentAccountId || undefined,
        }),
      })
      setPaySheetOpen(false)
      setSelectedDebt(null)
      setPaymentAmount('')
      setPaymentAccountId('')
      loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save changes')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteDebt(id: string) {
    if (!confirm('Are you sure you want to delete this debt?')) return
    await fetch(`/api/debts/${id}`, { method: 'DELETE' })
    loadData()
  }

  // Handlers for Upcoming Dues Payments
  async function handlePayRecurringUpcoming(id: string) {
    setPayingId(id)
    await fetch(`/api/recurring/${id}/pay`, { method: 'POST' })
    loadUpcoming()
    loadData()
    setPayingId(null)
  }

  function handleOpenPayModalUpcoming(item: UpcomingItem) {
    setPayModalItem(item)
    setPayModalAmount(String(item.amount))
    setPayModalAccountId(item.accountId || '')
  }

  async function handleExecutePayUpcoming(e: React.FormEvent) {
    e.preventDefault()
    if (!payModalItem) return
    setPayModalLoading(true)
    try {
      if (payModalItem.source === 'CREDIT_CARD') {
        await saveRequest(`/api/credit-cards/${payModalItem.sourceId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(payModalAmount),
            accountId: payModalAccountId || undefined,
          }),
        })
      } else if (payModalItem.source === 'DEBT') {
        await saveRequest(`/api/debts/${payModalItem.sourceId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(payModalAmount),
            accountId: payModalAccountId || undefined,
          }),
        })
      }
      setPayModalItem(null)
      loadUpcoming()
      loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save changes')
    } finally {
      setPayModalLoading(false)
    }
  }

  const allPayments = debts.flatMap((d) =>
    (d.payments || []).map((p) => ({
      ...p,
      debtName: d.name,
      debtType: d.type,
      direction: d.direction,
    }))
  )

  const sortedHistory = allPayments.sort(
    (a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
  )

  const filteredDebts = activeDebts.filter((d) => {
    if (directionFilter !== 'ALL' && d.direction !== directionFilter) return false
    if (typeFilter === 'ALL') return true
    return d.type === typeFilter
  })

  const PRIORITY_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

  const sortedDebts = [...filteredDebts].sort((a, b) => {
    if (sortBy === 'priority') {
      const pDiff = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0)
      if (pDiff !== 0) return pDiff
      return Number(b.remaining) - Number(a.remaining)
    }
    if (sortBy === 'date') {
      const getDateVal = (d: Debt) => {
        if (d.isRecurring && d.paymentDate) {
          const now = new Date()
          const due = new Date(now.getFullYear(), now.getMonth(), d.paymentDate)
          if (due < now) due.setMonth(due.getMonth() + 1)
          return due.getTime()
        }
        if (d.deadline) return new Date(d.deadline).getTime()
        return Infinity
      }
      return getDateVal(a) - getDateVal(b)
    }
    if (sortBy === 'amount') {
      return Number(b.remaining) - Number(a.remaining)
    }
    return (b as any).id > (a as any).id ? 1 : -1
  })

  const filteredUpcomingItems = upcomingFilter === 'ALL'
    ? upcomingItems
    : upcomingItems.filter(item => item.source === upcomingFilter)

  return (
    <div className="pb-4">
      {/* Tab Selectors & Export Action */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-border dark:border-gray-800">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
          <button
            onClick={() => setTab('active')}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium flex-shrink-0 transition-all',
              tab === 'active'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            )}
          >
            Debts & Lending
          </button>
          <button
            onClick={() => setTab('upcoming')}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium flex-shrink-0 transition-all',
              tab === 'upcoming'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            )}
          >
            Upcoming Dues & Bills
          </button>
          <button
            onClick={() => setTab('history')}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium flex-shrink-0 transition-all',
              tab === 'history'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            )}
          >
            Payment History
          </button>
        </div>

        <button
          onClick={() => {
            setExportScope(tab === 'upcoming' ? 'upcoming' : 'debts')
            setExportModalOpen(true)
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border dark:border-gray-700 bg-surface-offset/60 dark:bg-gray-800/80 hover:bg-surface-offset dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-all flex-shrink-0 active:scale-95"
          title="Export Debts & Dues"
        >
          <Download size={13} className="text-primary" />
          <span>Export</span>
        </button>
      </div>

      {/* Aggregated Total Debt Overview Card */}
      <div className="px-4 mt-3 mb-4">
        <Card className="p-4 bg-gradient-to-br from-primary to-primary-hover text-white shadow-md border-0">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-white/70 font-medium">Total Outstanding Debt (All Liabilities)</p>
              <h3 className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                {formatCurrency(totalAggregatedDebt)}
              </h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white backdrop-blur-sm">
                {activeDebts.length} active records
              </span>
            </div>
          </div>

          {/* Aggregated Debt Breakdown Mini Cards */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-center">
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-white/70">Personal Debts</p>
              <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(personalDebtsTotal)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-white/70">Cards & PayLater</p>
              <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(creditCardsTotal)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <p className="text-[10px] text-white/70">Loans & EMIs</p>
              <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(loansRemainingTotal)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="px-4 mb-4"><Card className="p-4"><p className="text-xs text-gray-500">Owed to me</p><p className="text-xl font-bold text-success">{formatCurrency(lentTotal)}</p><p className="text-xs text-gray-400">Money you lent, separate from your liabilities.</p></Card></div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-danger">{error}</p>}

      {/* TAB 1: ACTIVE DEBTS & LIABILITIES */}
      {tab === 'active' && (
        <div className="px-4 space-y-4">
          <Select id="debt-direction-filter" label="Show" value={directionFilter} onChange={e => setDirectionFilter(e.target.value as typeof directionFilter)}>
            <option value="ALL">All debts and lending</option><option value="BORROWED">I owe</option><option value="LENT">Owed to me</option>
          </Select>
          {/* Type Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border',
                typeFilter === 'ALL'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              All ({activeDebts.length})
            </button>
            {(['PERSONAL', 'LOAN', 'CREDIT_LINE', 'PAY_LATER'] as const)
              .filter((t) => debts.some((d) => d.type === t))
              .map((t) => {
                const count = debts.filter((d) => d.type === t).length
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border',
                      typeFilter === t
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    )}
                  >
                    {TYPE_LABELS[t]} ({count})
                  </button>
                )
              })}
          </div>


          {/* Sort By Controls */}
          <div className="flex items-center justify-between gap-2 px-1 bg-surface-offset/50 dark:bg-gray-800/40 p-2 rounded-xl">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort:</span>
            <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 justify-end">
              {[
                { id: 'priority', label: 'Priority' },
                { id: 'date', label: 'Due Date' },
                { id: 'amount', label: 'Amount' },
                { id: 'created', label: 'Latest' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id as any)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                    sortBy === s.id
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-surface-offset dark:hover:bg-gray-800'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading debts...</p>
          ) : sortedDebts.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Landmark className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-base font-semibold dark:text-gray-300">
                {typeFilter === 'ALL' ? 'No active debts found' : `No ${TYPE_LABELS[typeFilter]} debts found`}
              </p>
              <p className="text-xs mt-1">Tap + below to add your first record</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedDebts.map((debt) => {
                const paidAmount = Number(debt.amount) - Number(debt.remaining)
                const pct = Math.min(100, Math.round((paidAmount / Number(debt.amount)) * 100))

                return (
                  <Card key={debt.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base dark:text-white">{debt.name}</p>
                          <Badge
                            style={{
                              backgroundColor: (TYPE_COLORS[debt.type] || '#6b7280') + '20',
                              color: TYPE_COLORS[debt.type] || '#6b7280',
                            }}
                          >
                            {debt.direction === 'LENT' ? 'Owed to me' : 'I owe'} · {TYPE_LABELS[debt.type]}
                          </Badge>
                          <Badge
                            style={{
                              backgroundColor: (PRIORITY_COLORS[debt.priority] || '#10b981') + '20',
                              color: PRIORITY_COLORS[debt.priority] || '#10b981',
                            }}
                          >
                            {debt.priority}
                          </Badge>
                        </div>
                        {debt.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {debt.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-danger">
                          {formatCurrency(debt.remaining)}
                        </p>
                        <p className="text-xs text-gray-400">of {formatCurrency(debt.amount)}</p>
                      </div>
                    </div>

                    <div>
                      <ProgressBar value={pct} max={100} className="mb-1.5" />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{pct}% {debt.direction === 'LENT' ? 'repaid to you' : 'paid off'}</span>
                        <span>{formatCurrency(paidAmount)} paid</span>
                      </div>
                    </div>

                    {debt.interestRate > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Interest Rate: <span className="font-medium">{debt.interestRate}%</span>
                      </p>
                    )}

                    {debt.type === 'LOAN' && debt.isRecurring && debt.paymentAmount && debt.totalInstallments && debt.startDate && (
                      <div className="rounded-xl bg-primary/5 p-3 text-xs dark:bg-primary/10">
                        <div className="flex justify-between"><span>Loan term</span><span className="font-semibold">{debt.payments.length}/{debt.totalInstallments} installments recorded</span></div>
                        <div className="mt-1 flex justify-between"><span>Monthly EMI</span><span className="font-semibold">{formatCurrency(debt.paymentAmount)}</span></div>
                        <Button id={`view-loan-schedule-${debt.id}`} size="sm" variant="outline" onClick={() => setScheduleDebt(debt)} className="mt-3">View installment breakdown</Button>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-border dark:border-gray-800">
                      <div className="text-xs text-gray-400">
                        {debt.isRecurring && debt.paymentDate ? (
                          <span>Due day {debt.paymentDate} monthly</span>
                        ) : debt.deadline ? (
                          <span>Target: {new Date(debt.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        ) : (
                          <span>No deadline set</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(debt)}
                          className="px-2 py-1 min-h-[32px] text-gray-600 dark:text-gray-300"
                          title="Edit Debt"
                        >
                          <Edit2 size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="px-2 py-1 min-h-[32px] text-danger border-danger/30 hover:bg-danger/10"
                          title="Delete Debt"
                        >
                          <Trash2 size={13} />
                        </Button>
                        <Button
                          id={`record-debt-payment-${debt.id}`}
                          size="sm"
                          onClick={() => {
                            setError('')
                            setPaymentDate(new Date().toISOString().slice(0, 10))
                            setSelectedDebt(debt)
                            setPaymentAmount(
                              debt.paymentAmount
                                ? String(Math.min(debt.paymentAmount, debt.remaining))
                                : String(debt.remaining)
                            )
                            setPaySheetOpen(true)
                          }}
                          className="gap-1 text-xs py-1 px-3 min-h-[32px]"
                        >
                          <CheckCircle size={13} /> {debt.direction === 'LENT' ? 'Receive' : 'Pay'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          <FAB onClick={() => setAddSheetOpen(true)} />
        </div>
      )}

      {/* TAB 2: UPCOMING DUES & BILLS */}
      {tab === 'upcoming' && (
        <div className="px-4 space-y-4">
          {/* Timeframe Selector */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {[
              { id: 'thisMonth', label: 'This Month' },
              { id: 'next7Days', label: 'Next 7 Days' },
              { id: 'next30Days', label: 'Next 30 Days' },
              { id: 'nextMonth', label: 'Next Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setUpcomingTimeframe(tf.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all',
                  upcomingTimeframe === tf.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-offset dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {upcomingTimeframe === 'custom' && (
            <Card className="p-3 bg-surface-offset dark:bg-gray-800/40 grid grid-cols-2 gap-3 border-dashed">
              <DatePicker
                label="Start Date"
                name="customStart"
                value={customRange.startDate}
                onChange={(e) => setCustomRange(p => ({ ...p, startDate: e.target.value }))}
              />
              <DatePicker
                label="End Date"
                name="customEnd"
                value={customRange.endDate}
                onChange={(e) => setCustomRange(p => ({ ...p, endDate: e.target.value }))}
              />
            </Card>
          )}

          {/* Upcoming Summary Card */}
          <Card className="p-4 bg-surface-offset dark:bg-gray-800/60 border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Scheduled Dues for Period
              </span>
              <span className="text-xs font-bold text-danger tabular-nums">
                {formatCurrency(upcomingSummary.total)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{upcomingSummary.totalCount} upcoming dues</span>
              {upcomingSummary.overdueCount > 0 && (
                <span className="text-danger font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> {upcomingSummary.overdueCount} overdue
                </span>
              )}
            </div>
          </Card>

          <Select id="debt-direction-filter" label="Show" value={directionFilter} onChange={e => setDirectionFilter(e.target.value as typeof directionFilter)}>
            <option value="ALL">All debts and lending</option><option value="BORROWED">I owe</option><option value="LENT">Owed to me</option>
          </Select>
          {/* Type Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            <button
              onClick={() => setUpcomingFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border',
                upcomingFilter === 'ALL'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
              )}
            >
              All ({upcomingItems.length})
            </button>
            {upcomingItems.some(i => i.source === 'CREDIT_CARD') && (
              <button
                onClick={() => setUpcomingFilter('CREDIT_CARD')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                  upcomingFilter === 'CREDIT_CARD'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
                )}
              >
                <CreditCard size={13} /> Cards ({upcomingItems.filter(i => i.source === 'CREDIT_CARD').length})
              </button>
            )}
            {upcomingItems.some(i => i.source === 'RECURRING') && (
              <button
                onClick={() => setUpcomingFilter('RECURRING')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                  upcomingFilter === 'RECURRING'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
                )}
              >
                <RefreshCw size={13} /> Recurring ({upcomingItems.filter(i => i.source === 'RECURRING').length})
              </button>
            )}
            {upcomingItems.some(i => i.source === 'DEBT') && (
              <button
                onClick={() => setUpcomingFilter('DEBT')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all border flex items-center gap-1.5',
                  upcomingFilter === 'DEBT'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-offset dark:bg-gray-800 border-border dark:border-gray-700 text-gray-600 dark:text-gray-300'
                )}
              >
                <Landmark size={13} /> Debts ({upcomingItems.filter(i => i.source === 'DEBT').length})
              </button>
            )}
          </div>


          {/* Dues List */}
          {upcomingLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUpcomingItems.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Calendar className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-base font-semibold dark:text-gray-300">No upcoming dues found</p>
              <p className="text-xs mt-1">
                You're all clear for this timeframe or all upcoming bills are settled.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredUpcomingItems.map(item => {
                const dateObj = new Date(item.dueDate)
                const dateFormatted = dateObj.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                })

                return (
                  <Card key={item.id} className="p-4 space-y-3 relative overflow-hidden">
                    <div
                      className={cn(
                        'absolute top-0 left-0 bottom-0 w-1',
                        item.isOverdue
                          ? 'bg-danger'
                          : item.daysLeft <= 3
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      )}
                    />

                    <div className="flex justify-between items-start pl-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold dark:text-white text-sm">{item.name}</p>
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0.5',
                              item.source === 'CREDIT_CARD' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                              item.source === 'RECURRING' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                              item.source === 'DEBT' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {item.typeLabel}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          Due: <span className="font-medium text-gray-600 dark:text-gray-300">{dateFormatted}</span>
                          {item.accountName && <span>· From: {item.accountName}</span>}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-danger">
                          {formatCurrency(item.amount)}
                        </p>
                        {item.source === 'CREDIT_CARD' && item.remainingTotal && item.remainingTotal !== item.amount ? (
                          <p className="text-[10px] text-gray-400">Total: {formatCurrency(item.remainingTotal)}</p>
                        ) : item.minimumAmount && item.minimumAmount > 0 && item.minimumAmount !== item.amount ? (
                          <p className="text-[10px] text-gray-400">Min: {formatCurrency(item.minimumAmount)}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border dark:border-gray-800 pl-1.5">
                      <div className="text-xs">
                        {item.isOverdue ? (
                          <span className="text-danger font-semibold flex items-center gap-1">
                            <AlertCircle size={13} /> Overdue by {Math.abs(item.daysLeft)} days
                          </span>
                        ) : item.daysLeft === 0 ? (
                          <span className="text-amber-500 font-semibold flex items-center gap-1">
                            <AlertCircle size={13} /> Due Today!
                          </span>
                        ) : item.daysLeft === 1 ? (
                          <span className="text-amber-500 font-medium">Due Tomorrow</span>
                        ) : (
                          <span className="text-gray-400">In {item.daysLeft} days</span>
                        )}
                        {item.paidCount !== undefined && item.totalCount && (
                          <span className="text-gray-400 ml-2">
                            ({item.paidCount}/{item.totalCount} paid)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {item.source === 'RECURRING' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePayRecurringUpcoming(item.sourceId)}
                            loading={payingId === item.sourceId}
                            className="gap-1 text-xs py-1 px-3 min-h-[32px]"
                          >
                            <CheckCircle size={13} /> Mark Paid
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModalUpcoming(item)}
                            className="gap-1 text-xs py-1 px-3 min-h-[32px]"
                          >
                            Pay / Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT HISTORY */}
      {tab === 'history' && (
        <div className="px-4">
          {sortedHistory.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-base font-semibold dark:text-gray-300">No payment history yet</p>
              <p className="text-xs mt-1">Payments made will appear here chronologically</p>
            </Card>
          ) : (
            <Card className="divide-y divide-border dark:divide-gray-800">
              {sortedHistory.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-4">
                  <div>
                    <p className="font-semibold text-sm dark:text-white">{p.debtName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(p.paidDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {p.debtType && ` · ${TYPE_LABELS[p.debtType]}`}
                    </p>
                  </div>
                  <p className="font-bold text-success tabular-nums">
                    {p.direction === 'LENT' ? 'Received ' : 'Paid '}{formatCurrency(p.amount)}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Add Debt Sheet */}
      {scheduleDebt && <LoanScheduleSheet debt={scheduleDebt} onClose={() => setScheduleDebt(null)} />}

      {/* Add Debt Sheet */}
      <Sheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add Debt / Lending">
        <form onSubmit={handleAddDebt} className="space-y-4 pb-6">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Select id="add-debt-direction" label="Direction" value={debtForm.direction} onChange={e => setDebtForm(p => ({ ...p, direction: e.target.value as Debt['direction'] }))}>
            <option value="BORROWED">I owe — money I borrowed</option>
            <option value="LENT">Owed to me — money I lent</option>
          </Select>
          <p className="text-xs text-gray-500">Track an existing balance. Adding this record does not move money between accounts.</p>
          <Input
            label="Name / Title"
            value={debtForm.name}
            onChange={(e) => setDebtForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Rahul, Car Loan"
            required
          />

          <Select
            label="Type"
            value={debtForm.type}
            onChange={(e) => setDebtForm((p) => ({ ...p, type: e.target.value as any }))}
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Original Amount"
              type="number"
              min="0"
              step="0.01"
              value={debtForm.amount}
              onChange={(e) => setDebtForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
            <Input
              label="Interest Rate % (Annual)"
              type="number"
              step="0.01"
              value={debtForm.interestRate}
              onChange={(e) => setDebtForm((p) => ({ ...p, interestRate: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 pb-1">
            <input
              type="checkbox"
              id="isRecurring"
              checked={debtForm.isRecurring}
              onChange={(e) => setDebtForm((p) => ({ ...p, isRecurring: e.target.checked }))}
              className="w-4 h-4 text-primary rounded-md border-border dark:border-gray-700"
            />
            <label htmlFor="isRecurring" className="text-sm font-medium dark:text-gray-200">
              Recurring Monthly Payment / EMI
            </label>
          </div>

          {debtForm.isRecurring ? (
            <><div className="grid grid-cols-2 gap-3">
              <Input
                label="Monthly Due Day (1-31)"
                type="number"
                min="1"
                max="31"
                value={debtForm.paymentDate}
                onChange={(e) => setDebtForm((p) => ({ ...p, paymentDate: e.target.value }))}
                placeholder="e.g. 5"
                required
              />
              <Input
                label="Monthly Amount"
                type="number"
                min="0.01"
                step="0.01"
                value={debtForm.paymentAmount}
                onChange={(e) => setDebtForm((p) => ({ ...p, paymentAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>{debtForm.type === 'LOAN' && <div className="grid grid-cols-2 gap-3"><Input id="loan-total-installments" label="Total installments" type="number" min="1" value={debtForm.totalInstallments} onChange={(e) => setDebtForm(p => ({ ...p, totalInstallments: e.target.value }))} required /><DatePicker label="First EMI date" name="loan-start-date" value={debtForm.startDate} onChange={(e) => setDebtForm(p => ({ ...p, startDate: e.target.value }))} required /></div>}</>
          ) : (
            <DatePicker
              label="Target Payoff Deadline (Optional)"
              name="deadline"
              value={debtForm.deadline}
              onChange={(e) => setDebtForm((p) => ({ ...p, deadline: e.target.value }))}
            />
          )}

          <Select
            label="Priority Level"
            value={debtForm.priority}
            onChange={(e) => setDebtForm((p) => ({ ...p, priority: e.target.value as any }))}
          >
            <option value="LOW">Low Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="HIGH">High Priority (Urgent)</option>
          </Select>

          <Input
            label="Notes / Description (Optional)"
            value={debtForm.description}
            onChange={(e) => setDebtForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Add any context..."
          />

          <Button type="submit" size="lg" loading={loading}>
            Add Debt
          </Button>
        </form>
      </Sheet>

      {/* Edit Debt Sheet */}
      <Sheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} title="Edit Debt / Lending">
        <form onSubmit={handleSaveEdit} className="space-y-4 pb-6">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Select id="edit-debt-direction" label="Direction" value={editForm.direction} onChange={e => setEditForm(p => ({ ...p, direction: e.target.value as Debt['direction'] }))}>
            <option value="BORROWED">I owe — money I borrowed</option>
            <option value="LENT">Owed to me — money I lent</option>
          </Select>
          <p className="text-xs text-gray-500">Track an existing balance. Adding this record does not move money between accounts.</p>
          <Input
            label="Name / Title"
            value={editForm.name}
            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Rahul, Car Loan"
            required
          />

          <Select
            label="Type"
            value={editForm.type}
            onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as any }))}
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Total Principal Amount"
              type="number"
              min="0"
              step="0.01"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
            <Input
              label="Remaining Balance"
              type="number"
              min="0"
              step="0.01"
              value={editForm.remaining}
              onChange={(e) => setEditForm((p) => ({ ...p, remaining: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>

          <Input
            label="Interest Rate % (Annual)"
            type="number"
            step="0.01"
            value={editForm.interestRate}
            onChange={(e) => setEditForm((p) => ({ ...p, interestRate: e.target.value }))}
            placeholder="0"
          />

          <div className="flex items-center gap-2 pt-1 pb-1">
            <input
              type="checkbox"
              id="editIsRecurring"
              checked={editForm.isRecurring}
              onChange={(e) => setEditForm((p) => ({ ...p, isRecurring: e.target.checked }))}
              className="w-4 h-4 text-primary rounded-md border-border dark:border-gray-700"
            />
            <label htmlFor="editIsRecurring" className="text-sm font-medium dark:text-gray-200">
              Recurring Monthly Payment / EMI
            </label>
          </div>

          {editForm.isRecurring ? (
            <><div className="grid grid-cols-2 gap-3">
              <Input
                label="Monthly Due Day (1-31)"
                type="number"
                min="1"
                max="31"
                value={editForm.paymentDate}
                onChange={(e) => setEditForm((p) => ({ ...p, paymentDate: e.target.value }))}
                placeholder="e.g. 5"
                required
              />
              <Input
                label="Monthly Amount"
                type="number"
                min="0.01"
                step="0.01"
                value={editForm.paymentAmount}
                onChange={(e) => setEditForm((p) => ({ ...p, paymentAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>{editForm.type === 'LOAN' && <div className="grid grid-cols-2 gap-3"><Input id="edit-loan-total-installments" label="Total installments" type="number" min="1" value={editForm.totalInstallments} onChange={(e) => setEditForm(p => ({ ...p, totalInstallments: e.target.value }))} required /><DatePicker label="First EMI date" name="edit-loan-start-date" value={editForm.startDate} onChange={(e) => setEditForm(p => ({ ...p, startDate: e.target.value }))} required /></div>}</>
          ) : (
            <DatePicker
              label="Target Payoff Deadline (Optional)"
              name="editDeadline"
              value={editForm.deadline}
              onChange={(e) => setEditForm((p) => ({ ...p, deadline: e.target.value }))}
            />
          )}

          <Select
            label="Priority Level"
            value={editForm.priority}
            onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as any }))}
          >
            <option value="LOW">Low Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="HIGH">High Priority (Urgent)</option>
          </Select>

          <Input
            label="Notes / Description (Optional)"
            value={editForm.description}
            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Add any context..."
          />

          <Button type="submit" size="lg" loading={loading}>
            Save Changes
          </Button>
        </form>
      </Sheet>

      {/* Record Debt Payment Sheet */}
      <Sheet open={paySheetOpen} onClose={() => setPaySheetOpen(false)} title={selectedDebt?.direction === 'LENT' ? "Receive Repayment" : "Record Debt Payment"}>
        {selectedDebt && (
          <form onSubmit={handleRecordPayment} className="space-y-4 pb-6">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="p-3 bg-surface-offset dark:bg-gray-800/60 rounded-xl space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Recording payment for</p>
              <p className="font-bold text-base dark:text-white">{selectedDebt.name}</p>
              <p className="text-xs text-danger font-semibold">
                Remaining: {formatCurrency(selectedDebt.remaining)}
              </p>
            </div>

            <Input
              label="Payment Amount"
              type="number"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              required
            />

            <Select
              label={selectedDebt.direction === 'LENT' ? "Receive Into Account" : "Deduct From Account"}
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
            >
              <option value="">None (Settled externally / Cash)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            <DatePicker
              label="Payment Date"
              name="paymentDate"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />

            <Button type="submit" size="lg" loading={loading}>
              {selectedDebt.direction === 'LENT' ? 'Confirm Repayment Received' : 'Confirm & Record Payment'}
            </Button>
          </form>
        )}
      </Sheet>

      {/* Quick Pay Modal for Upcoming Items */}
      <Sheet
        open={Boolean(payModalItem)}
        onClose={() => setPayModalItem(null)}
        title={payModalItem ? `Record Payment for ${payModalItem.name}` : 'Record Payment'}
      >
        {payModalItem && (
          <form onSubmit={handleExecutePayUpcoming} className="space-y-4 pb-6">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="p-3 bg-surface-offset dark:bg-gray-800/60 rounded-xl space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">{payModalItem.typeLabel}</p>
              <p className="font-bold text-base dark:text-white">{payModalItem.name}</p>
              <p className="text-xs text-danger font-semibold">Total Due: {formatCurrency(payModalItem.amount)}</p>
            </div>

            <Input
              label="Payment Amount"
              type="number"
              step="any"
              value={payModalAmount}
              onChange={(e) => setPayModalAmount(e.target.value)}
              placeholder="0.00"
              required
            />

            <Select
              label="Deduct From Account"
              value={payModalAccountId}
              onChange={(e) => setPayModalAccountId(e.target.value)}
            >
              <option value="">None (Paid from outside / Cash)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            <Button type="submit" size="lg" loading={payModalLoading}>
              Confirm & Record Payment
            </Button>
          </form>
        )}
      </Sheet>

      {/* Export Liabilities & Dues Modal */}
      <ExportLiabilitiesModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        initialScope={exportScope}
        debts={debts}
        recurring={recurringList}
        creditCards={creditCards}
        upcomingItems={upcomingItems}
        upcomingSummary={upcomingSummary}
      />
    </div>
  )
}
