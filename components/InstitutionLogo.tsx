import { INSTITUTIONS, InstitutionId } from '@/lib/institutions'
import { Landmark } from 'lucide-react'

export function InstitutionLogo({ institution, size = 40 }: { institution?: string | null; size?: number }) {
  const id = (institution && institution in INSTITUTIONS ? institution : 'OTHER') as InstitutionId
  const details = INSTITUTIONS[id]
  const style = details.logoUrl ? { width: Math.round(size * 1.6), height: size } : { width: size, height: size }
  if (details.logoUrl) return (
    <span style={style} className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700">
      {/* Logos remain unmodified and are loaded from each provider or its published brand artwork. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={details.logoUrl} alt={`${details.label} logo`} className="h-full w-full object-contain" loading="lazy" />
    </span>
  )
  return <span aria-label="Other institution" style={style} className="flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800"><Landmark size={size * 0.45} /></span>
}
