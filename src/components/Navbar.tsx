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

  function isActive(href: string) {
    if (href === '/applications') return pathname === '/applications' || pathname.startsWith('/applications/')
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-canvas/90 backdrop-blur-md border-b border-hairline sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-ink text-base tracking-tight">
          <span className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
              <rect x="1" y="1.5" width="5" height="6.5" rx="1" fill="currentColor" opacity="0.9"/>
              <rect x="8" y="1.5" width="5" height="3.5" rx="1" fill="currentColor" opacity="0.5"/>
              <rect x="8" y="7" width="5" height="5.5" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="1" y="10" width="5" height="3" rx="1" fill="currentColor" opacity="0.5"/>
            </svg>
          </span>
          JobTrack
        </Link>
        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-surface-2 text-ink'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-1'
              }`}
            >
              {label}
              {href === '/notifications' && unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          ))}
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-ink-tertiary hover:text-ink-subtle transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
