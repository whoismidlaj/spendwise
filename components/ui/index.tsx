'use client'
import { cn } from '@/lib/utils'
import React, { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react'

// Button
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-xl transition-all min-h-[44px]',
        variant === 'primary' && 'bg-primary hover:bg-primary-hover text-white disabled:opacity-60',
        variant === 'outline' && 'border border-border dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-surface-offset dark:hover:bg-gray-800',
        variant === 'ghost' && 'text-gray-600 dark:text-gray-300 hover:bg-surface-offset dark:hover:bg-gray-800',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  )
}

// Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, ...props }, ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-white placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
          error && 'border-danger focus:ring-danger/30',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, value, onChange, onBlur, name, ...props }, ref
) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLSelectElement | null>(null)
  
  const setRefs = React.useCallback((node: HTMLSelectElement | null) => {
    selectRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as any).current = node
    }
  }, [ref])

  const options = React.Children.toArray(children)
    .filter(child => React.isValidElement(child) && child.type === 'option')
    .map(child => {
      const el = child as React.ReactElement<React.HTMLProps<HTMLOptionElement>>
      return {
        value: String(el.props.value ?? ''),
        label: String(el.props.children ?? ''),
      }
    })

  const [selectedValue, setSelectedValue] = React.useState('')

  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(String(value))
    } else if (selectRef.current) {
      setSelectedValue(selectRef.current.value)
    }
  }, [value, children])

  const selectedOption = options.find(o => o.value === selectedValue) || options[0]

  const handleSelect = (val: string) => {
    setSelectedValue(val)
    setIsOpen(false)
    if (selectRef.current) {
      selectRef.current.value = val
      const event = new Event('change', { bubbles: true })
      selectRef.current.dispatchEvent(event)
    }
  }

  return (
    <div className="flex flex-col gap-1 relative w-full">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      
      <select
        ref={setRefs}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className="sr-only"
        {...props}
      >
        {children}
      </select>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-white text-left text-sm min-h-[44px]',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
          error && 'border-danger',
          className
        )}
      >
        <span>{selectedOption?.label || 'Select option'}</span>
        <svg className={cn("w-4 h-4 text-gray-500 transition-transform ml-2", isOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-[120] bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm hover:bg-surface-offset dark:hover:bg-gray-800 transition-colors dark:text-white',
                  opt.value === selectedValue && 'bg-primary/5 text-primary dark:text-primary font-medium'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})

// Badge
interface BadgeProps {
  children: React.ReactNode
  color?: string
  className?: string
  style?: React.CSSProperties
}

export function Badge({ children, color, className, style }: BadgeProps) {
  const colorStyle = color ? { backgroundColor: color + '20', color } : {}
  return (
    <span
      className={cn('inline-flex max-w-full items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium', className)}
      style={{ ...colorStyle, ...style }}
    >
      {children}
    </span>
  )
}

// Card
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-800 shadow-sm',
      className
    )}>
      {children}
    </div>
  )
}

// Sheet (bottom sheet modal)
interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div
        className="relative bg-white dark:bg-gray-900 rounded-t-3xl sheet-enter max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border dark:border-gray-800 relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          <div className="flex items-center justify-between mt-2">
            {title ? (
              <h2 className="text-base font-semibold dark:text-white">{title}</h2>
            ) : (
              <div />
            )}
            <button
              onClick={onClose}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  )
}

// FAB — Floating Action Button
export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mobile-fab fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary p-0 text-white shadow-xl transition-all hover:bg-primary-hover active:scale-95"
      aria-label="Add payment or transfer"
      title="Add payment or transfer"
    >
      <Plus size={27} strokeWidth={2.25} aria-hidden="true" />
    </button>
  )
}

// Progress Bar
export function ProgressBar({
  value, max, className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = pct < 30 ? '#437a22' : pct < 70 ? '#da7101' : '#a12c7b'
  return (
    <div className={cn('h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// DatePicker
interface DatePickerProps {
  label?: string
  value?: string
  onChange?: (e: any) => void
  onBlur?: (e: any) => void
  name?: string
  error?: string
  required?: boolean
  className?: string
}

function PickerDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[360px] overflow-hidden rounded-3xl border border-border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {children}
      </div>
    </div>,
    document.body,
  )
}

function parseLocalDate(value?: string) {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : new Date()
}

function pickerChange(onChange: DatePickerProps['onChange'], name: string | undefined, value: string) {
  onChange?.({ target: { name, value } })
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { label, value, onChange, onBlur, name, error, required, className, ...props }, ref
) {
  const [isOpen, setIsOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  
  const setRefs = React.useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as any).current = node
    }
  }, [ref])

  const [dateVal, setDateVal] = React.useState('')

  React.useEffect(() => {
    if (value !== undefined) {
      setDateVal(value)
    } else if (inputRef.current) {
      setDateVal(inputRef.current.value)
    }
  }, [value])

  const [draftDate, setDraftDate] = React.useState(value || '')
  const [currentDate, setCurrentDate] = React.useState(() => parseLocalDate(value))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const blanksCount = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const blanks = Array(blanksCount).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const calendarCells = [...blanks, ...days]

  const openPicker = () => {
    setDraftDate(dateVal)
    setCurrentDate(parseLocalDate(dateVal))
    setIsOpen(true)
  }

  const commitDate = (selectedDate: string) => {
    if (required && !selectedDate) return
    setDateVal(selectedDate)
    setIsOpen(false)
    pickerChange(onChange, name, selectedDate)
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  const displayDate = () => {
    if (!dateVal) return 'Select date'
    const [y, m, d] = dateVal.split('-')
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
    return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-1 relative w-full">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      
      <input
        ref={setRefs}
        type="hidden"
        name={name}
        className="sr-only"
        value={dateVal}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        {...props}
      />

      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-white text-left text-sm min-h-[44px] w-full',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
          error && 'border-danger',
          className
        )}
      >
        <span className={cn(!dateVal && 'text-gray-400 dark:text-gray-500')}>{displayDate()}</span>
        <CalendarIcon className="w-4.5 h-4.5 text-gray-400" />
      </button>

      {isOpen && <PickerDialog title="Choose date" onClose={() => setIsOpen(false)}>
        <div className="border-b border-border px-5 pb-4 pt-5 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Choose date</p>
          <p className="mt-1 text-xl font-semibold dark:text-white">{draftDate ? (() => { const [y, m, d] = draftDate.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' }) })() : 'No date selected'}</p>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-offset dark:hover:bg-gray-800" aria-label="Previous month"><ChevronLeft size={20} /></button>
            <span className="text-sm font-semibold dark:text-white">{monthNames[month]} {year}</span>
            <button type="button" onClick={nextMonth} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-offset dark:hover:bg-gray-800" aria-label="Next month"><ChevronRight size={20} /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center">
            {weekdays.map(day => <span key={day} className="py-1 text-[11px] font-semibold text-gray-400">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 place-items-center gap-y-1">
            {calendarCells.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="h-10 w-10" />
              const candidate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const selected = draftDate === candidate
              return <button key={candidate} type="button" onClick={() => setDraftDate(candidate)} aria-pressed={selected} className={cn('flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors', selected ? 'bg-primary font-semibold text-white' : 'hover:bg-surface-offset dark:text-white dark:hover:bg-gray-800')}>{day}</button>
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-3 dark:border-gray-800">
          {!required && dateVal && <button type="button" onClick={() => commitDate('')} className="mr-auto min-h-11 rounded-xl px-3 text-sm font-semibold text-danger">Clear</button>}
          <button type="button" onClick={() => { const today = new Date(); const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; setDraftDate(todayValue); setCurrentDate(today) }} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-primary">Today</button>
          <button type="button" onClick={() => setIsOpen(false)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-gray-500">Cancel</button>
          <button type="button" onClick={() => commitDate(draftDate)} disabled={!draftDate} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">Done</button>
        </div>
      </PickerDialog>}
      {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})

interface TimePickerProps {
  label?: string
  value: string
  onChange: (e: { target: { name?: string; value: string } }) => void
  name?: string
  error?: string
  className?: string
}

function timeParts(value: string) {
  const [rawHour, rawMinute] = value.split(':').map(Number)
  const hour24 = Number.isFinite(rawHour) ? Math.min(23, Math.max(0, rawHour)) : 0
  const minute = Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 0
  return { hour: hour24 % 12 || 12, minute, period: hour24 >= 12 ? 'PM' as const : 'AM' as const }
}

export function TimePicker({ label, value, onChange, name, error, className }: TimePickerProps) {
  const initial = timeParts(value)
  const [isOpen, setIsOpen] = React.useState(false)
  const [hour, setHour] = React.useState(initial.hour)
  const [minute, setMinute] = React.useState(initial.minute)
  const [period, setPeriod] = React.useState<'AM' | 'PM'>(initial.period)
  const hourList = React.useRef<HTMLDivElement>(null)
  const minuteList = React.useRef<HTMLDivElement>(null)

  const openPicker = () => {
    const parts = timeParts(value)
    setHour(parts.hour)
    setMinute(parts.minute)
    setPeriod(parts.period)
    setIsOpen(true)
  }

  React.useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => {
      hourList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
      minuteList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  const displayTime = (timeValue: string) => {
    const parts = timeParts(timeValue)
    return `${parts.hour}:${String(parts.minute).padStart(2, '0')} ${parts.period}`
  }

  const commitTime = () => {
    const hour24 = hour % 12 + (period === 'PM' ? 12 : 0)
    const nextValue = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    onChange({ target: { name, value: nextValue } })
    setIsOpen(false)
  }

  return <div className="flex w-full flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <input type="hidden" name={name} value={value} />
    <button type="button" onClick={openPicker} aria-haspopup="dialog" aria-expanded={isOpen} className={cn('flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-800 dark:text-white', error && 'border-danger', className)}>
      <span>{displayTime(value)}</span><Clock3 size={18} className="text-gray-400" />
    </button>
    {isOpen && <PickerDialog title="Choose time" onClose={() => setIsOpen(false)}>
      <div className="border-b border-border px-5 pb-4 pt-5 dark:border-gray-800"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Choose time</p><p className="mt-1 text-3xl font-semibold tabular-nums dark:text-white">{hour}:{String(minute).padStart(2, '0')} <span className="text-xl text-gray-500">{period}</span></p></div>
      <div className="grid grid-cols-[1fr_1fr_72px] gap-2 p-4">
        <div><p className="mb-1 text-center text-[11px] font-semibold uppercase text-gray-400">Hour</p><div ref={hourList} className="scrollbar-hide h-56 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl bg-surface-offset p-1 dark:bg-gray-800">{Array.from({ length: 12 }, (_, index) => index + 1).map(item => <button key={item} type="button" role="option" aria-selected={hour === item} onClick={() => setHour(item)} className={cn('flex h-11 w-full snap-center items-center justify-center rounded-lg text-sm tabular-nums', hour === item ? 'bg-white font-bold text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500')}>{String(item).padStart(2, '0')}</button>)}</div></div>
        <div><p className="mb-1 text-center text-[11px] font-semibold uppercase text-gray-400">Minute</p><div ref={minuteList} className="scrollbar-hide h-56 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl bg-surface-offset p-1 dark:bg-gray-800">{Array.from({ length: 60 }, (_, item) => item).map(item => <button key={item} type="button" role="option" aria-selected={minute === item} onClick={() => setMinute(item)} className={cn('flex h-11 w-full snap-center items-center justify-center rounded-lg text-sm tabular-nums', minute === item ? 'bg-white font-bold text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500')}>{String(item).padStart(2, '0')}</button>)}</div></div>
        <div><p className="mb-1 text-center text-[11px] font-semibold uppercase text-gray-400">Period</p><div className="space-y-2 rounded-xl bg-surface-offset p-1 dark:bg-gray-800">{(['AM', 'PM'] as const).map(item => <button key={item} type="button" onClick={() => setPeriod(item)} className={cn('flex h-11 w-full items-center justify-center rounded-lg text-xs font-semibold', period === item ? 'bg-white text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500')}>{item}</button>)}</div></div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3 dark:border-gray-800"><button type="button" onClick={() => setIsOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-gray-500">Cancel</button><button type="button" onClick={commitTime} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white">Done</button></div>
    </PickerDialog>}
    {error && <p className="mt-0.5 text-xs text-danger">{error}</p>}
  </div>
}
