'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/dashboard',     label: 'Dashboard' },
  { href: '/applications',  label: 'Applications' },
  { href: '/resumes',       label: 'Resumes' },
  { href: '/profile',       label: 'Profile' },
  { href: '/notifications', label: 'Notifications' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnread(count ?? 0)
    })
  }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-canvas border-b border-hairline sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-semibold text-primary text-base tracking-tight">
          JobTrack
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-surface-2 text-ink'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {label}
              {href === '/notifications' && unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          ))}
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-ink-subtle hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
