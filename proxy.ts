import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: ['/dashboard', '/accounts', '/transactions', '/expenses', '/reports', '/settings'],
}
