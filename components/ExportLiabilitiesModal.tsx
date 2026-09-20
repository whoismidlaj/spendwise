'use client'
import React, { useState } from 'react'
import { Card, Button, Sheet, Badge } from '@/components/ui'
import {
  FileSpreadsheet,
  Printer,
  FileCode,
  Download,
  CheckCircle2,
  Calendar,
  Landmark,
  RefreshCw,
  CreditCard,
  Layers,
  ArrowUpRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  downloadCSV,
  downloadJSON,
  generateDebtsCSV,
  generateRecurringCSV,
  generateUpcomingDuesCSV,
  generateAllLiabilitiesCSV,
} from '@/lib/export-liabilities'

export type ExportScope = 'all' | 'debts' | 'recurring' | 'upcoming'

interface ExportLiabilitiesModalProps {
  open: boolean
  onClose: () => void
  initialScope?: ExportScope
  debts?: any[]
  recurring?: any[]
  creditCards?: any[]
  upcomingItems?: any[]
  upcomingSummary?: any
}

export function ExportLiabilitiesModal({
  open,
  onClose,
  initialScope = 'all',
  debts = [],
  recurring = [],
  creditCards = [],
  upcomingItems = [],
  upcomingSummary,
}: ExportLiabilitiesModalProps) {
  const [scope, setScope] = useState<ExportScope>(initialScope)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sync initial scope if opened with a specific preset
  React.useEffect(() => {
    if (open && initialScope) {
      setScope(initialScope)
    }
  }, [open, initialScope])

  const debtsTotal = debts.filter(d => d.direction !== 'LENT').reduce((sum, d) => sum + Number(d.remaining || 0), 0)
  const emiMonthlyTotal = recurring.reduce((sum, r) => sum + Number(r.emiAmount || 0), 0)
  const cardsTotal = creditCards.reduce((sum, c) => {
    const used = Number(c.usedLimit || 0)
    const due = Number(c.dueAmount || 0)
    return sum + (used > 0 ? used : due)
  }, 0)
  const upcomingTotal = upcomingSummary?.total ?? upcomingItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)

  const dateStamp = new Date().toISOString().slice(0, 10)

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  function handleExportCSV() {
    setDownloading('csv')
    try {
      if (scope === 'all') {
        const content = generateAllLiabilitiesCSV({ debts, recurring, creditCards })
        downloadCSV(`spendwise-liabilities-all-${dateStamp}`, content)
        showSuccess('Complete liabilities spreadsheet downloaded!')
      } else if (scope === 'debts') {
        const content = generateDebtsCSV(debts)
        downloadCSV(`spendwise-debts-${dateStamp}`, content)
        showSuccess('Debts & liabilities spreadsheet downloaded!')
      } else if (scope === 'recurring') {
        const content = generateRecurringCSV(recurring)
        downloadCSV(`spendwise-recurring-emis-${dateStamp}`, content)
        showSuccess('Recurring expenses & EMIs spreadsheet downloaded!')
      } else if (scope === 'upcoming') {
        const content = generateUpcomingDuesCSV(upcomingItems, upcomingSummary)
        downloadCSV(`spendwise-upcoming-dues-${dateStamp}`, content)
        showSuccess('Upcoming dues schedule downloaded!')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDownloading(null)
    }
  }

  function handleExportJSON() {
    setDownloading('json')
    try {
      let exportData: any = {}
      if (scope === 'all') {
        exportData = {
          exportedAt: new Date().toISOString(),
          debts,
          recurringExpenses: recurring,
          creditCards,
          upcomingDues: upcomingItems,
        }
        downloadJSON(`spendwise-liabilities-${dateStamp}`, exportData)
      } else if (scope === 'debts') {
        exportData = {
          exportedAt: new Date().toISOString(),
          debts,
        }
        downloadJSON(`spendwise-debts-${dateStamp}`, exportData)
      } else if (scope === 'recurring') {
        exportData = {
          exportedAt: new Date().toISOString(),
          recurringExpenses: recurring,
        }
        downloadJSON(`spendwise-recurring-emis-${dateStamp}`, exportData)
      } else if (scope === 'upcoming') {
        exportData = {
          exportedAt: new Date().toISOString(),
          upcomingSummary,
          upcomingItems,
        }
        downloadJSON(`spendwise-upcoming-dues-${dateStamp}`, exportData)
      }
      showSuccess('JSON data file downloaded!')
    } catch (err) {
      console.error(err)
    } finally {
      setDownloading(null)
    }
  }

  function handleOpenPrintStatement() {
    // Open dedicated statement view with query parameter
    window.open(`/statement?scope=${scope}`, '_blank')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Export EMIs & Liabilities">
      <div className="space-y-4 pb-6">
        {/* Scope Selector */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
            Select What to Export
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={cn(
                'p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all',
                scope === 'all'
                  ? 'border-primary bg-primary/5 text-primary dark:border-primary shadow-xs'
                  : 'border-border dark:border-gray-800 bg-surface-offset/50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              <Layers size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold leading-snug">All Liabilities</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Debts, EMIs & Cards</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScope('recurring')}
              className={cn(
                'p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all',
                scope === 'recurring'
                  ? 'border-primary bg-primary/5 text-primary dark:border-primary shadow-xs'
                  : 'border-border dark:border-gray-800 bg-surface-offset/50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              <RefreshCw size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold leading-snug">Recurring & EMIs</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{recurring.length} active schedules</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScope('debts')}
              className={cn(
                'p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all',
                scope === 'debts'
                  ? 'border-primary bg-primary/5 text-primary dark:border-primary shadow-xs'
                  : 'border-border dark:border-gray-800 bg-surface-offset/50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              <Landmark size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold leading-snug">Debts & Loans</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{debts.length} debt accounts</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScope('upcoming')}
              className={cn(
                'p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all',
                scope === 'upcoming'
                  ? 'border-primary bg-primary/5 text-primary dark:border-primary shadow-xs'
                  : 'border-border dark:border-gray-800 bg-surface-offset/50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              <Calendar size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold leading-snug">Upcoming Dues</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{upcomingItems.length} due items</p>
              </div>
            </button>
          </div>
        </div>

        {/* Scope Overview Preview Card */}
        <div className="p-3.5 bg-surface-offset dark:bg-gray-800/60 rounded-2xl border border-border dark:border-gray-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {scope === 'all' && 'Scope: All Outstanding Commitments'}
              {scope === 'recurring' && `Scope: ${recurring.length} Recurring EMIs & Subs`}
              {scope === 'debts' && `Scope: ${debts.length} Active Debts & Loans`}
              {scope === 'upcoming' && `Scope: ${upcomingItems.length} Upcoming Scheduled Payments`}
            </span>
            <span className="font-bold text-gray-900 dark:text-white tabular-nums">
              {scope === 'all' && formatCurrency(debtsTotal + cardsTotal)}
              {scope === 'recurring' && `${formatCurrency(emiMonthlyTotal)}/mo`}
              {scope === 'debts' && formatCurrency(debtsTotal)}
              {scope === 'upcoming' && formatCurrency(upcomingTotal)}
            </span>
          </div>
        </div>

        {/* Success Feedback Alert */}
        {successMsg && (
          <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-xl flex items-center gap-2 text-xs text-green-800 dark:text-green-300 font-medium">
            <CheckCircle2 size={16} className="text-success flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Format Options */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            Choose Export Format
          </label>

          {/* Option 1: CSV Spreadsheet */}
          <div className="p-3.5 rounded-2xl border border-border dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold dark:text-white">Excel / CSV Spreadsheet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Clean table with columns, payment schedules, and formula totals.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleExportCSV}
              loading={downloading === 'csv'}
              className="gap-1.5 whitespace-nowrap text-xs px-3.5 py-2 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download size={14} /> Download
            </Button>
          </div>

          {/* Option 2: Printable Statement / PDF */}
          <div className="p-3.5 rounded-2xl border border-border dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Printer size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold dark:text-white">Printable Statement / PDF</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Formatted financial report with charts & tables ready to print or save as PDF.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenPrintStatement}
              className="gap-1.5 whitespace-nowrap text-xs px-3.5 py-2 min-h-[38px]"
            >
              <ArrowUpRight size={14} /> View / PDF
            </Button>
          </div>

          {/* Option 3: JSON Data */}
          <div className="p-3.5 rounded-2xl border border-border dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                <FileCode size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold dark:text-white">Structured JSON</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Raw backup format for developer tools or offline archiving.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExportJSON}
              loading={downloading === 'json'}
              className="gap-1.5 whitespace-nowrap text-xs px-3.5 py-2 min-h-[38px] border border-border dark:border-gray-800"
            >
              <Download size={14} /> JSON
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
