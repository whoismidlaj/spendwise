'use client'
import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BankAccountsPanel } from '@/components/accounts/BankAccountsPanel'
import { CardsPanel } from '@/components/accounts/CardsPanel'
import { LoansPanel } from '@/components/accounts/LoansPanel'
import { RecurringPaymentsPanel } from '@/components/accounts/RecurringPaymentsPanel'
import { LoadingState, PageContainer, SectionTabs } from '@/components/ui'

const SECTIONS = [
  { id: 'banks', label: 'Bank accounts' },
  { id: 'cards', label: 'Cards & pay later' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'loans', label: 'Loans & debts' },
] as const
type SectionId = typeof SECTIONS[number]['id']

const panels: Record<SectionId, () => React.ReactElement> = {
  banks: () => <BankAccountsPanel />,
  cards: () => <CardsPanel />,
  recurring: () => <RecurringPaymentsPanel />,
  loans: () => <LoansPanel />,
}

function AccountsSections() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const requested = params.get('section')
  const section: SectionId = SECTIONS.some(item => item.id === requested) ? requested as SectionId : 'banks'
  // The selected section lives in the URL so refresh, Back and shared links keep it.
  const select = (id: string) => router.push(`${pathname}?section=${id}`, { scroll: false })
  return (
    <PageContainer className="space-y-4">
      <SectionTabs label="Accounts sections" tabs={SECTIONS.map(item => ({ ...item }))} active={section} onChange={select} />
      <div role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>{panels[section]()}</div>
    </PageContainer>
  )
}

export default function AccountsPage() {
  return <Suspense fallback={<PageContainer><LoadingState /></PageContainer>}><AccountsSections /></Suspense>
}
