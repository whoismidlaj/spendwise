'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-border dark:border-gray-800"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-offset dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              {initials}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 bg-white dark:bg-gray-900 border border-border dark:border-gray-700 rounded-xl shadow-lg w-44 py-1">
                  <div className="px-3 py-2 border-b border-border dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-surface-offset dark:hover:bg-gray-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={15} />
                    Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-offset dark:hover:bg-gray-800"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
