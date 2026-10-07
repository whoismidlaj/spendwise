'use client'
import { useEffect, useState } from 'react'
import { setActiveCurrency } from '@/lib/currency'

// Loads the user's currency before any amount renders, so no value flashes in the wrong currency.
export function CurrencyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then(response => response.ok ? response.json() : null)
      .then(user => setActiveCurrency(user?.currency))
      .catch(() => setActiveCurrency(undefined))
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])
  if (!ready) return <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  return <>{children}</>
}
