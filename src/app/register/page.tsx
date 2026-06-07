'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas auth-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
              <rect x="2" y="3" width="7" height="9" rx="1.5" fill="currentColor" opacity="0.9"/>
              <rect x="11" y="3" width="7" height="5" rx="1.5" fill="currentColor" opacity="0.5"/>
              <rect x="11" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7"/>
              <rect x="2" y="14" width="7" height="3" rx="1.5" fill="currentColor" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-ink tracking-[-1.0px]">JobTrack</h1>
          <p className="text-ink-tertiary mt-1.5 text-sm">Your job search, organised.</p>
        </div>
        <div className="bg-surface-1 rounded-xl border border-hairline p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <h2 className="text-base font-semibold text-ink mb-5 tracking-[-0.3px]">Create your account</h2>
          {error && (
            <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-subtle mb-1.5 uppercase tracking-wide">Full name</label>
              <input
                type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full rounded-md border border-hairline-strong bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-subtle mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-hairline-strong bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-subtle mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-md border border-hairline-strong bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors"
                placeholder="min. 6 characters"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white rounded-md py-2.5 text-sm font-medium transition-colors disabled:opacity-50 mt-1"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-ink-tertiary mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary-hover font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
