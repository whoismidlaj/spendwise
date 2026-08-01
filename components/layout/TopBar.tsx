'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Settings, Moon, Sun, LogOut, Menu, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() ?? 'U'

  return (
    <header className={cn("sticky top-0 bg-white dark:bg-gray-900 border-b border-border dark:border-gray-800", menuOpen ? "z-[200]" : "z-40")}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-offset dark:hover:bg-gray-800 active:scale-95 transition-all"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>
        
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-offset dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {mounted ? (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />) : <div className="w-[18px] h-[18px]" />}
        </button>
      </div>

      {/* Slide-in left drawer */}
      <div className={cn("fixed inset-0 z-[150] transition-all duration-300", menuOpen ? "visible" : "invisible")}>
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300 ease-out",
            menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMenuOpen(false)}
        />
        
        {/* Drawer Panel */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out transform overflow-y-auto",
            menuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-transparent border-b border-border dark:border-gray-800 flex flex-col items-center text-center relative pt-8">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1 hover:bg-surface-offset dark:hover:bg-gray-850 rounded-lg transition-colors"
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
            <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-3 shadow-md">
              {initials}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              {session?.user?.name || 'Spendwise User'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-full">
              {session?.user?.email}
            </p>
          </div>

          <div className="flex-1 py-4 px-2 space-y-1">
            <div className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Navigation
            </div>
            {[
              { href: '/dashboard', label: 'Dashboard', icon: '📊' },
              { href: '/accounts', label: 'Accounts & Cards', icon: '💳' },
              { href: '/transactions', label: 'Transactions', icon: '💸' },
              { href: '/expenses', label: 'Recurring Expenses', icon: '🔄' },
              { href: '/debts', label: 'Debts Tracker', icon: '📉' },
              { href: '/reports', label: 'Reports & Trends', icon: '📈' },
              { href: '/settings', label: 'App Settings', icon: '⚙️' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-surface-offset dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="p-4 border-t border-border dark:border-gray-800 bg-surface-offset dark:bg-gray-850 space-y-2">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
            <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 pt-1">
              Spendwise App v1.0.0
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
