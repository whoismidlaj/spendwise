export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard', '/accounts', '/transactions', '/expenses', '/reports', '/settings'],
}
