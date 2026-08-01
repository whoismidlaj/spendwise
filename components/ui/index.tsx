'use client'
import { cn } from '@/lib/utils'
import React, { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'

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

// Select — forwardRef
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, ...props }, ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none',
          error && 'border-danger',
          className
        )}
        {...props}
      >
        {children}
      </select>
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
