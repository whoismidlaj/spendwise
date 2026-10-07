'use client'
import React from 'react'
import { Button } from './button'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Open dialogs, innermost last: only the topmost one reacts to Escape and Tab.
const openDialogs: object[] = []

// Dialog behaviour shared by sheets: Escape closes, Tab stays inside, focus returns to the trigger.
function useDialogFocus(open: boolean, onClose: () => void) {
  const panel = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose
  React.useEffect(() => {
    if (!open) return
    const trigger = document.activeElement as HTMLElement | null
    const token = {}
    openDialogs.push(token)
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button')
    ;(first ?? panel.current)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(item => item.offsetParent !== null)
      if (!items.length) { event.preventDefault(); return }
      const firstItem = items[0], lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); openDialogs.splice(openDialogs.indexOf(token), 1); trigger?.focus?.() }
  }, [open])
  return panel
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panel = useDialogFocus(open, onClose)
  const titleId = React.useId()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className="relative bg-white dark:bg-gray-900 rounded-t-3xl sheet-enter max-h-[92vh] flex flex-col focus:outline-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex-shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border dark:border-gray-800 relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" aria-hidden="true" />
          <div className="flex items-center justify-between mt-2">
            {title ? <h2 id={titleId} className="text-base font-semibold dark:text-white">{title}</h2> : <div />}
            <button type="button" onClick={onClose} className="min-h-[44px] px-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Close</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

// Replaces window.confirm so confirmations match the rest of the app and stay accessible.
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', destructive, loading, error, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="space-y-4 pb-2">
        <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} data-autofocus>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Sheet>
  )
}
