'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, remainingPrincipal } from '@/lib/currency'
import { Button, Badge, Card, ProgressBar } from '@/components/ui'
import {
  Printer,
  Download,
  ArrowLeft,
  Calendar,
  Landmark,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react'
import {
  downloadCSV,
  generateAllLiabilitiesCSV,
  generateDebtsCSV,
  generateRecurringCSV,
  generateUpcomingDuesCSV,
  DEBT_TYPE_LABELS,
  RECURRING_TYPE_LABELS
} from '@/lib/export-liabilities'

export default function StatementPage() {
  const searchParams = useSearchParams()
  const initialScope = searchParams.get('scope') || 'all'

  const [scope, setScope] = useState<string>(initialScope)
  const [user, setUser] = useState<{ name?: string; email?: string; currency?: string } | null>(null)
  const [debts, setDebts] = useState<any[]>([])
  const [recurring, setRecurring] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [upcomingItems, setUpcomingItems] = useState<any[]>([])
  const [upcomingSummary, setUpcomingSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [userData, debtsData, recData, cardsData, upcomingRes] = await Promise.all([
          fetch('/api/settings').then(r => r.json()),
          fetch('/api/debts').then(r => r.json()),
          fetch('/api/recurring').then(r => r.json()),
          fetch('/api/credit-cards').then(r => r.json()),
          fetch('/api/expenses/upcoming').then(r => r.json()),
        ])
        setUser(userData)
        setDebts(debtsData || [])
        setRecurring(recData || [])
        setCreditCards(cardsData || [])
        setUpcomingItems(upcomingRes?.items || [])
        setUpcomingSummary(upcomingRes?.summary || null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Total liabilities calculation
  const personalDebtsTotal = debts.reduce((sum, d) => sum + Number(d.remaining || 0), 0)
  const personalDebtsPrincipal = debts.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  const personalDebtsPaid = Math.max(0, personalDebtsPrincipal - personalDebtsTotal)

  const creditCardsTotal = creditCards.reduce((sum, c) => {
    const used = Number(c.usedLimit || 0)
    const due = Number(c.dueAmount || 0)
    return sum + (used > 0 ? used : due)
  }, 0)

  const loansRemainingTotal = recurring
    .filter(r => (r.type === 'EMI' || r.type === 'LOAN') && r.loanAmount && r.totalEMIs)
    .reduce((sum, r) => {
      const rem = remainingPrincipal(Number(r.loanAmount), Number(r.interestRate ?? 0), Number(r.totalEMIs), Number(r.paidEMIs))
      return sum + (rem || 0)
    }, 0)

  const totalOutstandingLiabilities = personalDebtsTotal + creditCardsTotal + loansRemainingTotal
  const emiMonthlyTotal = recurring.reduce((s, r) => s + Number(r.emiAmount || 0), 0)
  const totalMonthlyCommitment = emiMonthlyTotal +
    debts.filter(d => d.isRecurring && d.paymentAmount).reduce((s, d) => s + Number(d.paymentAmount || 0), 0)

  const overallProgress = personalDebtsPrincipal > 0
    ? Math.round((personalDebtsPaid / personalDebtsPrincipal) * 100)
    : 100

  function handlePrint() {
    window.print()
  }

  function handleExportCSV() {
    const dateStamp = new Date().toISOString().slice(0, 10)
    if (scope === 'all') {
      const content = generateAllLiabilitiesCSV({ debts, recurring, creditCards })
      downloadCSV(`spendwise-financial-statement-${dateStamp}`, content)
    } else if (scope === 'debts') {
      const content = generateDebtsCSV(debts)
      downloadCSV(`spendwise-debts-${dateStamp}`, content)
    } else if (scope === 'recurring') {
      const content = generateRecurringCSV(recurring)
      downloadCSV(`spendwise-recurring-emis-${dateStamp}`, content)
    } else if (scope === 'upcoming') {
      const content = generateUpcomingDuesCSV(upcomingItems, upcomingSummary)
      downloadCSV(`spendwise-upcoming-dues-${dateStamp}`, content)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Generating Financial Statement...</p>
      </div>
    )
  }

  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-16 print:bg-white print:p-0 print:m-0">
      {/* Top Action Toolbar (Hidden during Print) */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-border dark:border-gray-800 px-4 py-3 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/debts"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-offset dark:hover:bg-gray-800 transition-colors"
              title="Back"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h2 className="text-sm font-bold dark:text-white">Liabilities Statement</h2>
              <p className="text-[10px] text-gray-400">Print or save as PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex gap-1 bg-surface-offset dark:bg-gray-800 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All' },
                { id: 'debts', label: 'Debts' },
                { id: 'recurring', label: 'EMIs' },
                { id: 'upcoming', label: 'Dues' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    scope === tab.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs px-3 py-1.5 min-h-[36px]"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">Download</span> CSV
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs px-3.5 py-1.5 min-h-[36px] bg-primary text-white"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Printable Document Sheet */}
      <div className="max-w-4xl mx-auto px-4 pt-6 print:p-0 print:max-w-full">
        <div className="bg-white dark:bg-gray-900 print:bg-white border border-border dark:border-gray-800 print:border-0 rounded-3xl print:rounded-none p-6 sm:p-10 shadow-sm print:shadow-none space-y-8">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border dark:border-gray-800 print:border-gray-300">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💰</span>
                <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white print:text-black">
                  SPENDWISE
                </h1>
              </div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">
                Financial Liabilities & Dues Statement
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <p className="text-sm font-bold text-gray-900 dark:text-white print:text-black">
                {user?.name || 'Account Holder'}
              </p>
              <p className="text-xs text-gray-500 print:text-gray-600">{user?.email}</p>
              <p className="text-xs text-gray-400 print:text-gray-500 mt-1">
                Generated: <span className="font-medium text-gray-600 dark:text-gray-300 print:text-black">{currentDateFormatted}</span>
              </p>
            </div>
          </div>

          {/* Executive KPI Summary Cards */}
          {(scope === 'all' || scope === 'debts') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 print:bg-gray-50 rounded-2xl border border-border dark:border-gray-800 print:border-gray-200">
                <p className="text-[11px] font-medium text-gray-500 print:text-gray-600">Total Outstanding</p>
                <p className="text-lg sm:text-xl font-bold text-danger tabular-nums mt-1">
                  {formatCurrency(totalOutstandingLiabilities)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 print:bg-gray-50 rounded-2xl border border-border dark:border-gray-800 print:border-gray-200">
                <p className="text-[11px] font-medium text-gray-500 print:text-gray-600">Monthly Commitment</p>
                <p className="text-lg sm:text-xl font-bold text-primary tabular-nums mt-1">
                  {formatCurrency(totalMonthlyCommitment)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 print:bg-gray-50 rounded-2xl border border-border dark:border-gray-800 print:border-gray-200">
                <p className="text-[11px] font-medium text-gray-500 print:text-gray-600">Debt Payoff Progress</p>
                <p className="text-lg sm:text-xl font-bold text-success tabular-nums mt-1">
                  {overallProgress}%
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 print:bg-gray-50 rounded-2xl border border-border dark:border-gray-800 print:border-gray-200">
                <p className="text-[11px] font-medium text-gray-500 print:text-gray-600">Active Schedules</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white print:text-black tabular-nums mt-1">
                  {debts.length + recurring.length + creditCards.length}
                </p>
              </div>
            </div>
          )}

          {/* SECTION 1: DEBTS & LIABILITIES TABLE */}
          {(scope === 'all' || scope === 'debts') && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <Landmark size={18} className="text-primary" />
                  Debts & Personal Loans ({debts.length})
                </h3>
                <span className="text-xs font-semibold text-danger tabular-nums">
                  Total: {formatCurrency(personalDebtsTotal)}
                </span>
              </div>

              {debts.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 italic">No debts or loans recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border dark:border-gray-800 print:border-gray-300 text-gray-500 print:text-gray-700 uppercase font-semibold text-[10px] tracking-wider">
                        <th className="py-2.5 px-2">Name</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2">Priority</th>
                        <th className="py-2.5 px-2 text-right">Principal</th>
                        <th className="py-2.5 px-2 text-right">Remaining</th>
                        <th className="py-2.5 px-2 text-center">Progress</th>
                        <th className="py-2.5 px-2">Terms / Deadline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 dark:divide-gray-800/60 print:divide-gray-200">
                      {debts.map((d) => {
                        const paid = Number(d.amount) - Number(d.remaining)
                        const pct = Math.min(100, Math.round((paid / Number(d.amount)) * 100))
                        return (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 print:hover:bg-transparent">
                            <td className="py-3 px-2 font-medium text-gray-900 dark:text-white print:text-black">
                              {d.name}
                              {d.description && (
                                <span className="block text-[10px] text-gray-400 font-normal">{d.description}</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-gray-600 dark:text-gray-300 print:text-gray-800">
                              {DEBT_TYPE_LABELS[d.type] || d.type}
                            </td>
                            <td className="py-3 px-2">
                              <Badge
                                className={`text-[10px] px-1.5 py-0.5 font-semibold ${
                                  d.priority === 'HIGH'
                                    ? 'bg-red-500/10 text-red-600'
                                    : d.priority === 'LOW'
                                    ? 'bg-green-500/10 text-green-600'
                                    : 'bg-yellow-500/10 text-yellow-600'
                                }`}
                              >
                                {d.priority}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right font-medium text-gray-600 dark:text-gray-300 print:text-gray-800 tabular-nums">
                              {formatCurrency(d.amount)}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-danger tabular-nums">
                              {formatCurrency(d.remaining)}
                            </td>
                            <td className="py-3 px-2 text-center tabular-nums">
                              <span className="font-semibold">{pct}%</span>
                            </td>
                            <td className="py-3 px-2 text-gray-500 dark:text-gray-400 print:text-gray-600 text-[11px]">
                              {d.isRecurring && d.paymentDate ? (
                                <span>Day {d.paymentDate} monthly ({formatCurrency(d.paymentAmount || 0)})</span>
                              ) : d.deadline ? (
                                <span>Target: {new Date(d.deadline).toLocaleDateString('en-IN')}</span>
                              ) : (
                                <span>Flexible</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: RECURRING EXPENSES & EMIs TABLE */}
          {(scope === 'all' || scope === 'recurring') && (
            <div className="space-y-3 pt-4 border-t border-border dark:border-gray-800 print:border-gray-300">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <RefreshCw size={18} className="text-purple-500" />
                  Recurring Expenses & EMIs ({recurring.length})
                </h3>
                <span className="text-xs font-semibold text-primary tabular-nums">
                  Monthly Commitment: {formatCurrency(emiMonthlyTotal)}
                </span>
              </div>

              {recurring.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 italic">No recurring EMIs recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border dark:border-gray-800 print:border-gray-300 text-gray-500 print:text-gray-700 uppercase font-semibold text-[10px] tracking-wider">
                        <th className="py-2.5 px-2">Name</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2 text-right">Monthly EMI</th>
                        <th className="py-2.5 px-2">Due Day</th>
                        <th className="py-2.5 px-2 text-center">EMIs Paid</th>
                        <th className="py-2.5 px-2 text-right">Est. Principal Remaining</th>
                        <th className="py-2.5 px-2">Linked Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 dark:divide-gray-800/60 print:divide-gray-200">
                      {recurring.map((item) => {
                        const rem = item.loanAmount && item.totalEMIs
                          ? remainingPrincipal(Number(item.loanAmount), Number(item.interestRate ?? 0), Number(item.totalEMIs), Number(item.paidEMIs))
                          : null

                        return (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 print:hover:bg-transparent">
                            <td className="py-3 px-2 font-medium text-gray-900 dark:text-white print:text-black">
                              {item.name}
                            </td>
                            <td className="py-3 px-2 text-gray-600 dark:text-gray-300 print:text-gray-800">
                              {RECURRING_TYPE_LABELS[item.type] || item.type}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-primary tabular-nums">
                              {formatCurrency(item.emiAmount)}
                            </td>
                            <td className="py-3 px-2 text-gray-600 dark:text-gray-400 tabular-nums">
                              Day {item.emiDate}
                            </td>
                            <td className="py-3 px-2 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                              {item.totalEMIs ? `${item.paidEMIs} / ${item.totalEMIs}` : `${item.paidEMIs} (Ongoing)`}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-danger tabular-nums">
                              {rem !== null ? formatCurrency(rem) : '—'}
                            </td>
                            <td className="py-3 px-2 text-gray-500 dark:text-gray-400 text-[11px]">
                              {item.account?.name || 'Unlinked'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: CREDIT CARDS & PAY LATER */}
          {(scope === 'all' || scope === 'debts') && creditCards.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border dark:border-gray-800 print:border-gray-300">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-500" />
                  Credit Cards & Pay Later Accounts ({creditCards.length})
                </h3>
                <span className="text-xs font-semibold text-danger tabular-nums">
                  Utilized: {formatCurrency(creditCardsTotal)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border dark:border-gray-800 print:border-gray-300 text-gray-500 print:text-gray-700 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-2.5 px-2">Account Name</th>
                      <th className="py-2.5 px-2">Bank / Issuer</th>
                      <th className="py-2.5 px-2 text-right">Total Limit</th>
                      <th className="py-2.5 px-2 text-right">Used Limit</th>
                      <th className="py-2.5 px-2 text-right">Current Due</th>
                      <th className="py-2.5 px-2">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 dark:divide-gray-800/60 print:divide-gray-200">
                    {creditCards.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 print:hover:bg-transparent">
                        <td className="py-3 px-2 font-medium text-gray-900 dark:text-white print:text-black">
                          {c.name}
                        </td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                          {c.bank} ({c.type === 'PAYLATER' ? 'Pay Later' : 'Card'})
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                          {formatCurrency(c.totalLimit)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                          {formatCurrency(c.usedLimit)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-danger tabular-nums">
                          {formatCurrency(c.dueAmount)}
                        </td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400 tabular-nums">
                          Day {c.dueDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: UPCOMING DUES TIMELINE (when upcoming scope selected) */}
          {scope === 'upcoming' && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  Upcoming Scheduled Payments ({upcomingItems.length})
                </h3>
                <span className="text-xs font-semibold text-danger tabular-nums">
                  Total: {formatCurrency(upcomingSummary?.total ?? upcomingItems.reduce((s, i) => s + Number(i.amount || 0), 0))}
                </span>
              </div>

              {upcomingItems.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 italic">No scheduled upcoming dues.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border dark:border-gray-800 print:border-gray-300 text-gray-500 print:text-gray-700 uppercase font-semibold text-[10px] tracking-wider">
                        <th className="py-2.5 px-2">Item</th>
                        <th className="py-2.5 px-2">Category</th>
                        <th className="py-2.5 px-2">Due Date</th>
                        <th className="py-2.5 px-2 text-right">Amount Due</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2">Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 dark:divide-gray-800/60 print:divide-gray-200">
                      {upcomingItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 print:hover:bg-transparent">
                          <td className="py-3 px-2 font-medium text-gray-900 dark:text-white print:text-black">
                            {item.name}
                          </td>
                          <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                            {item.typeLabel}
                          </td>
                          <td className="py-3 px-2 font-medium tabular-nums">
                            {new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-danger tabular-nums">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-3 px-2">
                            {item.isOverdue ? (
                              <span className="text-danger font-semibold flex items-center gap-1">
                                <AlertCircle size={12} /> Overdue by {Math.abs(item.daysLeft)}d
                              </span>
                            ) : item.daysLeft === 0 ? (
                              <span className="text-amber-500 font-semibold">Due Today</span>
                            ) : (
                              <span className="text-gray-500">In {item.daysLeft} days</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-gray-500 text-[11px]">
                            {item.bank || item.accountName || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Statement Footer */}
          <div className="pt-6 border-t border-border dark:border-gray-800 print:border-gray-300 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-gray-400 gap-2">
            <p>Spendwise Financial Tracker · Confidential Personal Statement</p>
            <p>Page 1 of 1 · Exported on {currentDateFormatted}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
