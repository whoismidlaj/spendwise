import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: ['/dashboard', '/accounts', '/transactions', '/payments', '/bills', '/debts', '/income', '/settings'],
}
