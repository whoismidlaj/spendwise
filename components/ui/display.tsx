import { cn } from '@/lib/utils'
import React from 'react'

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
