'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { mainNavigation as tabs } from '@/components/layout/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { CurrencyGate } from '@/components/layout/CurrencyGate'
import { cn } from '@/lib/utils'


const pageTitles: Record<string, string> = {
  '/dashboard': 'Plan',
  '/payments': 'Payments',
  '/accounts': 'Accounts',
  '/income': 'Income',
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
        <CurrencyGate>{children}</CurrencyGate>
      </main>
      <nav aria-label="Main" className="mobile-bottom-nav fixed left-0 right-0 z-50 border-t border-border bg-white dark:border-gray-800 dark:bg-gray-900 print:hidden">
          <div className="flex h-14 overflow-hidden">
            {tabs.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'min-h-[44px] min-w-0 flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors',
                    active
                      ? 'text-primary dark:text-primary'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} aria-hidden />
                  <span className={cn('max-w-full truncate text-[9px] font-medium min-[380px]:text-[10px]', active ? 'text-primary' : '')}>{label}</span>
                </Link>
              )
            })}
          </div>
      </nav>
    </div>
  )
}
