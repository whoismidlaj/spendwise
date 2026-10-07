import { Banknote, CalendarClock, LayoutDashboard, Settings, WalletCards } from 'lucide-react'

// Single source for bottom navigation and the drawer so names and icons never drift apart.
export const mainNavigation = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Plan' },
  { href: '/payments', icon: CalendarClock, label: 'Payments' },
  { href: '/accounts', icon: WalletCards, label: 'Accounts' },
  { href: '/income', icon: Banknote, label: 'Income' },
] as const

export const drawerNavigation = [...mainNavigation, { href: '/settings', icon: Settings, label: 'Settings' }] as const
