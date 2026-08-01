'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Wallet, ArrowLeftRight, RefreshCcw, BarChart3, Coins } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/accounts', icon: Wallet, label: 'Accounts' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/expenses', icon: RefreshCcw, label: 'Expenses' },
  { href: '/debts', icon: Coins, label: 'Debts' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/expenses': 'Expenses',
  '/debts': 'Debts',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'Spendwise'

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={title} />
      <main className="flex-1 safe-bottom overflow-auto">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border dark:border-gray-800 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(56px + env(safe-area-inset-bottom))' }}>
        <div className="flex h-14">
          {tabs.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[44px]',
                  active
                    ? 'text-primary dark:text-primary'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className={cn('text-[10px] font-medium', active ? 'text-primary' : '')}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
