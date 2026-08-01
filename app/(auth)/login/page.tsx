'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold dark:text-white">Spendwise</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your personal finance tracker</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-border dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-5 dark:text-white">Welcome back</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@spendwise.app"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={loading}>Sign In</Button>
          </form>

          <div className="mt-4 p-3 bg-surface-offset dark:bg-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400">
            <p className="font-medium mb-0.5">Demo credentials</p>
            <p>Email: demo@spendwise.app</p>
            <p>Password: demo1234</p>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
