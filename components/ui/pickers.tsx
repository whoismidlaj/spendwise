'use client'
import { cn } from '@/lib/utils'
import React, { forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'

// DatePicker
interface DatePickerProps {
  id?: string
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
  { id, label, value, onChange, onBlur, name, error, required, className, ...props }, ref
) {
  const autoId = React.useId()
  const buttonId = id ?? autoId
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
      {label && <label htmlFor={buttonId} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      
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
        id={buttonId}
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
  const buttonId = React.useId()
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
    {label && <label htmlFor={buttonId} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <input type="hidden" name={name} value={value} />
    <button id={buttonId} type="button" onClick={openPicker} aria-haspopup="dialog" aria-expanded={isOpen} className={cn('flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-800 dark:text-white', error && 'border-danger', className)}>
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
