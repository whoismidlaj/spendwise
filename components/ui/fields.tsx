'use client'
import { cn } from '@/lib/utils'
import React, { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

const fieldClass = 'px-3 py-2.5 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props }, ref
) {
  const autoId = React.useId()
  const inputId = id ?? autoId
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(fieldClass, 'placeholder-gray-400', error && 'border-danger focus:ring-danger/30', className)}
        {...props}
      />
      {error && <p id={`${inputId}-error`} className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

// Native select: keyboard, screen-reader and mobile pickers work without custom listbox code.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, id, ...props }, ref
) {
  const autoId = React.useId()
  const selectId = id ?? autoId
  return (
    <div className="relative flex w-full flex-col gap-1">
      {label && <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={cn(fieldClass, 'min-h-[44px] w-full appearance-none pr-9 text-sm', error && 'border-danger', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
      {error && <p id={`${selectId}-error`} className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
})
