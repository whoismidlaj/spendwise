'use client'
import { cn } from '@/lib/utils'
import React, { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

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

// Input — forwardRef so react-hook-form register() works
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

// Select — Custom styled component that integrates seamlessly with react-hook-form
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
      className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}
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
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border dark:border-gray-800 relative">
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
        <div className="overflow-y-auto flex-1 px-5 py-4">
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
      className="fixed right-4 z-40 w-14 h-14 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light transition-all"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      aria-label="Add"
    >
      +
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

  const [currentDate, setCurrentDate] = React.useState(() => {
    const initial = value || dateVal
    return initial ? new Date(initial) : new Date()
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const blanksCount = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const blanks = Array(blanksCount).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const calendarCells = [...blanks, ...days]

  const handleDateSelect = (day: number) => {
    const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setDateVal(selectedDateStr)
    setIsOpen(false)
    
    if (inputRef.current) {
      inputRef.current.value = selectedDateStr
      const event = new Event('change', { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }
    if (onChange) {
      onChange({ target: { name, value: selectedDateStr } })
    }
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
        type="date"
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
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-[120] bg-white dark:bg-gray-950 border border-border dark:border-gray-800 rounded-2xl shadow-xl p-4 w-72">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={prevMonth} className="p-1 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                <ChevronLeft className="w-4 h-4 dark:text-white" />
              </button>
              <span className="font-semibold text-sm dark:text-white">
                {monthNames[month]} {year}
              </span>
              <button type="button" onClick={nextMonth} className="p-1 hover:bg-surface-offset dark:hover:bg-gray-800 rounded-lg">
                <ChevronRight className="w-4 h-4 dark:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {weekdays.map(d => (
                <span key={d} className="text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />
                
                const isSelected = dateVal === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                
                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={cn(
                      "h-8 w-8 text-xs rounded-full flex items-center justify-center transition-colors dark:text-white",
                      isSelected
                        ? "bg-primary text-white font-semibold"
                        : "hover:bg-surface-offset dark:hover:bg-gray-800"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
      {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})
