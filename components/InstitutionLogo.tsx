import { INSTITUTIONS, InstitutionId } from '@/lib/institutions'
import { Landmark } from 'lucide-react'

export function InstitutionLogo({ institution, size = 40 }: { institution?: string | null; size?: number }) {
  const id = (institution && institution in INSTITUTIONS ? institution : 'OTHER') as InstitutionId
  const style = { width: size, height: size }
  if (id === 'HDFC_BANK' || id === 'HDFC_CARD') return <span aria-label="HDFC" style={style} className="flex items-center justify-center rounded-xl bg-[#004b8d]"><span className="h-5 w-5 border-4 border-[#ee1c25] bg-white" /></span>
  if (id === 'FEDERAL_BANK') return <span aria-label="Federal Bank" style={style} className="flex items-center justify-center rounded-xl bg-[#6c2b85] text-lg font-black italic text-white">F</span>
  if (id === 'JUPITER' || id === 'JUPITER_CSB_CARD') return <span aria-label="Jupiter" style={style} className="flex items-center justify-center rounded-xl bg-[#5b2da8] text-xl font-black text-white">J</span>
  if (id === 'CANARA_BANK') return <span aria-label="Canara Bank" style={style} className="flex items-center justify-center rounded-xl bg-[#005daa]"><span className="h-5 w-2.5 rounded-full bg-[#f5c400]" /></span>
  if (id === 'SBI_CARD') return <span aria-label="SBI Card" style={style} className="flex items-center justify-center rounded-xl bg-[#2d6ca2]"><span className="h-5 w-5 rounded-full border-[5px] border-white" /></span>
  if (id === 'AMAZON_PAY_LATER') return <span aria-label="Amazon Pay Later" style={style} className="flex items-center justify-center rounded-xl bg-white text-base font-black text-[#111] shadow-sm">a<span className="text-[#ff9900]">⌣</span></span>
  return <span aria-label="Other institution" style={style} className="flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800"><Landmark size={size * 0.45} /></span>
}
