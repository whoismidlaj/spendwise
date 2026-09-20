'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Banknote, History, LayoutDashboard, WalletCards } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Plan' },
  { href: '/accounts', icon: WalletCards, label: 'Accounts' },
  { href: '/transactions', icon: History, label: 'History' },
  { href: '/income', icon: Banknote, label: 'Income' },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Money Plan',
  '/income': 'Income',
  '/bills': 'Recurring Payments',
  '/accounts': 'Accounts',
  '/transactions': 'Transaction History',
  '/debts': 'Loans & Lending',
  '/settings': 'Settings',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'Spendwise'
  return (
    <div className="app-shell flex min-w-0 flex-col overflow-x-hidden">
      <TopBar title={title} />
      <div className="top-bar-spacer shrink-0" aria-hidden="true" />
      <main className={cn("min-w-0 flex-1 overflow-x-hidden overflow-y-auto", "safe-bottom")}>
        {children}
      </main>
      <nav className="mobile-bottom-nav fixed left-0 right-0 z-50 border-t border-border bg-white dark:border-gray-800 dark:bg-gray-900 print:hidden">
          <div className="flex h-14 overflow-hidden">
            {tabs.map(({ href, icon: Icon, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'min-h-[44px] min-w-0 flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors',
                    active
                      ? 'text-primary dark:text-primary'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={cn('max-w-full truncate text-[9px] font-medium min-[380px]:text-[10px]', active ? 'text-primary' : '')}>{label}</span>
                </Link>
              )
            })}
          </div>
      </nav>
    </div>
  )
}
