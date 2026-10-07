import React from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './display'

// One page rhythm for every screen: width, gutters and vertical spacing.
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-3xl space-y-4 px-3 py-3 sm:px-4 sm:py-4', className)}>{children}</div>
}

export function SummaryCard({ label, value, detail, children }: { label: string; value: React.ReactNode; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card className="bg-gradient-to-br from-primary to-primary-hover p-4 text-white sm:p-5">
      <p className="text-sm text-white/75">{label}</p>
      <p className="mt-1 whitespace-nowrap text-3xl font-bold tabular-nums">{value}</p>
      {detail && <p className="mt-2 text-xs text-white/70">{detail}</p>}
      {children && <div className="mt-4 border-t border-white/20 pt-4">{children}</div>}
    </Card>
  )
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0"><h2 className="font-semibold">{title}</h2>{description && <p className="text-xs text-gray-500">{description}</p>}</div>
      {action}
    </div>
  )
}

export function RecordList({ children, label }: { children: React.ReactNode; label?: string }) {
  return <Card className="overflow-hidden"><ul aria-label={label} className="divide-y divide-border dark:divide-gray-800">{children}</ul></Card>
}

interface RecordRowProps {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  amount?: React.ReactNode
  actions?: React.ReactNode
  muted?: boolean
}

export function RecordRow({ icon, title, subtitle, amount, actions, muted }: RecordRowProps) {
  return (
    <li className={cn('flex items-center gap-3 px-3.5 py-3.5', muted && 'opacity-70')}>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{title}</div>{subtitle && <div className="mt-0.5 truncate text-[11px] text-gray-500">{subtitle}</div>}</div>
      <div className="shrink-0 text-right">{amount && <div className="text-sm font-bold tabular-nums">{amount}</div>}{actions && <div className="mt-1 flex justify-end gap-1.5">{actions}</div>}</div>
    </li>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card className="p-8 text-center">
      {icon && <div className="mx-auto flex justify-center text-gray-400" aria-hidden="true">{icon}</div>}
      <p className="mt-2 font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <Card className="p-8 text-sm text-gray-500"><div role="status" className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden="true" />{label}</div></Card>
}

export function InlineError({ message }: { message?: string }) {
  if (!message) return null
  return <p role="alert" className="flex items-start gap-1.5 text-sm text-danger"><AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{message}</p>
}

export function FormSection({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3 dark:border-gray-700">
      {title && <legend className="px-1 text-sm font-semibold">{title}</legend>}
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {children}
    </fieldset>
  )
}

export interface SectionTab { id: string; label: string }

// Accessible tab list with arrow-key navigation; the active tab is reflected by the caller (e.g. in the URL).
export function SectionTabs({ tabs, active, onChange, label }: { tabs: SectionTab[]; active: string; onChange: (id: string) => void; label: string }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = (keys[event.key] + tabs.length) % tabs.length
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="grid overflow-hidden rounded-xl border border-border dark:border-gray-700" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={node => { refs.current[index] = node }}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={event => onKeyDown(event, index)}
          className={cn('min-h-[44px] min-w-0 truncate px-1 py-2.5 text-[11px] font-medium transition-colors sm:text-sm', active === tab.id ? 'bg-primary text-white' : 'text-gray-500 dark:text-gray-400')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
