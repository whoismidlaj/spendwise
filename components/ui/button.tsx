'use client'
import { cn } from '@/lib/utils'
import React, { ButtonHTMLAttributes } from 'react'

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
