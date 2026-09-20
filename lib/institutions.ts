export const INSTITUTION_IDS = ['HDFC_BANK', 'FEDERAL_BANK', 'JUPITER', 'CANARA_BANK', 'SBI_CARD', 'HDFC_CARD', 'JUPITER_CSB_CARD', 'AMAZON_PAY_LATER', 'OTHER'] as const
export type InstitutionId = typeof INSTITUTION_IDS[number]

export const INSTITUTIONS: Record<InstitutionId, { label: string; account: boolean; card: boolean; color: string }> = {
  HDFC_BANK: { label: 'HDFC Bank', account: true, card: false, color: '#004b8d' },
  FEDERAL_BANK: { label: 'Federal Bank', account: true, card: false, color: '#6c2b85' },
  JUPITER: { label: 'Jupiter', account: true, card: false, color: '#5b2da8' },
  CANARA_BANK: { label: 'Canara Bank', account: true, card: false, color: '#005daa' },
  SBI_CARD: { label: 'SBI Card', account: false, card: true, color: '#2d6ca2' },
  HDFC_CARD: { label: 'HDFC Bank Card', account: false, card: true, color: '#004b8d' },
  JUPITER_CSB_CARD: { label: 'Jupiter Edge CSB Card', account: false, card: true, color: '#5b2da8' },
  AMAZON_PAY_LATER: { label: 'Amazon Pay Later', account: false, card: true, color: '#ff9900' },
  OTHER: { label: 'Other', account: true, card: true, color: '#6b7280' },
}

export function inferInstitution(value?: string | null): InstitutionId {
  const normalized = (value || '').toLowerCase()
  if (normalized.includes('amazon')) return 'AMAZON_PAY_LATER'
  if (normalized.includes('jupiter') && normalized.includes('csb')) return 'JUPITER_CSB_CARD'
  if (normalized.includes('jupiter')) return 'JUPITER'
  if (normalized.includes('sbi')) return 'SBI_CARD'
  if (normalized.includes('hdfc')) return 'HDFC_BANK'
  if (normalized.includes('federal')) return 'FEDERAL_BANK'
  if (normalized.includes('canara')) return 'CANARA_BANK'
  return 'OTHER'
}
