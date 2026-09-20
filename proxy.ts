import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: ['/dashboard', '/accounts', '/transactions', '/bills', '/debts', '/income', '/settings'],
}
