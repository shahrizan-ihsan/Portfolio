'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/database'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
  }

  async function markAllRead() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-ink-subtle mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-surface-1 rounded-lg border border-hairline overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-ink-subtle">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-subtle">No notifications yet</div>
        ) : (
          <div className="divide-y divide-hairline">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-6 py-4 ${!n.is_read ? 'bg-surface-2/50' : ''}`}
              >
                <div
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-hairline-strong'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.is_read ? 'text-ink' : 'text-ink-subtle'}`}>
                    {n.title}
                  </p>
                  <p className="text-sm text-ink-subtle mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-ink-tertiary">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : ''}
                    </span>
                    {n.related_application_id && (
                      <Link
                        href={`/applications/${n.related_application_id}`}
                        className="text-xs text-primary hover:text-primary-hover transition-colors"
                      >
                        View application →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-xs text-ink-tertiary hover:text-ink-subtle shrink-0 transition-colors"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
