export const INSTITUTION_IDS = ['HDFC_BANK', 'FEDERAL_BANK', 'JUPITER', 'CANARA_BANK', 'SBI_CARD', 'HDFC_CARD', 'JUPITER_CSB_CARD', 'AMAZON_PAY_LATER', 'OTHER'] as const
export type InstitutionId = typeof INSTITUTION_IDS[number]

type Institution = { label: string; account: boolean; card: boolean; color: string; logoUrl?: string }

export const INSTITUTIONS: Record<InstitutionId, Institution> = {
  HDFC_BANK: { label: 'HDFC Bank', account: true, card: false, color: '#004b8d', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg' },
  FEDERAL_BANK: { label: 'Federal Bank', account: true, card: false, color: '#004cbe', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Federal_bank.logo.svg' },
  JUPITER: { label: 'Jupiter', account: true, card: false, color: '#fc7a69', logoUrl: 'https://jupiter.money/assets/images/website-v2/jupiter-logo.svg' },
  CANARA_BANK: { label: 'Canara Bank', account: true, card: false, color: '#005daa', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Canara_Bank_Logo.svg' },
  SBI_CARD: { label: 'SBI Card', account: false, card: true, color: '#2d6ca2', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/SBI_Card_logo.svg' },
  HDFC_CARD: { label: 'HDFC Bank Card', account: false, card: true, color: '#004b8d', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg' },
  JUPITER_CSB_CARD: { label: 'Jupiter Edge CSB Card', account: false, card: true, color: '#fc7a69', logoUrl: 'https://jupiter.money/assets/images/website-v2/jupiter-logo.svg' },
  AMAZON_PAY_LATER: { label: 'Amazon Pay Later', account: false, card: true, color: '#ff9900', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Amazon_Pay_logo.svg' },
  OTHER: { label: 'Other', account: true, card: true, color: '#6b7280' },
}

export function inferInstitution(value?: string | null, target: 'account' | 'card' = 'account'): InstitutionId {
  const normalized = (value || '').toLowerCase()
  if (normalized.includes('amazon')) return 'AMAZON_PAY_LATER'
  if (normalized.includes('jupiter') && normalized.includes('csb')) return 'JUPITER_CSB_CARD'
  if (normalized.includes('jupiter')) return target === 'card' ? 'JUPITER_CSB_CARD' : 'JUPITER'
  if (normalized.includes('sbi')) return 'SBI_CARD'
  if (normalized.includes('hdfc')) return target === 'card' ? 'HDFC_CARD' : 'HDFC_BANK'
  if (normalized.includes('federal')) return 'FEDERAL_BANK'
  if (normalized.includes('canara')) return 'CANARA_BANK'
  return 'OTHER'
}
