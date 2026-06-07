import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import type { Application, ApplicationStatus } from '@/types/database'

const STATUS_ORDER: ApplicationStatus[] = [
  'action_required', 'interview', 'offer',
  'submitted', 'acknowledged', 'under_review',
  'drafted', 'rejected', 'withdrawn',
]

function isOverdue(app: Application): boolean {
  if (!app.expected_next_update_date) return false
  return new Date(app.expected_next_update_date) < new Date()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: apps }, { data: profile }] = await Promise.all([
    supabase.from('applications').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false }),
    supabase.from('profiles').select('full_name').eq('user_id', user!.id).single(),
  ])

  const applications = (apps ?? []) as Application[]

  const stats = {
    total: applications.length,
    active: applications.filter(a => !['rejected', 'withdrawn', 'offer'].includes(a.status)).length,
    interviews: applications.filter(a => a.status === 'interview').length,
    offers: applications.filter(a => a.status === 'offer').length,
    actionRequired: applications.filter(a => a.action_required).length,
  }

  const sorted = [...applications].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status as ApplicationStatus) - STATUS_ORDER.indexOf(b.status as ApplicationStatus)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-ink-subtle text-sm mt-0.5">Here&apos;s your job search overview</p>
        </div>
        <Link
          href="/applications/new"
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + Add Application
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total',          value: stats.total,          color: 'text-ink' },
          { label: 'Active',         value: stats.active,         color: 'text-primary' },
          { label: 'Interviews',     value: stats.interviews,     color: 'text-success' },
          { label: 'Offers',         value: stats.offers,         color: 'text-success' },
          { label: 'Action Required',value: stats.actionRequired, color: 'text-primary' },
        ].map(stat => (
          <div key={stat.label} className="bg-surface-1 rounded-lg border border-hairline p-4">
            <p className="text-xs text-ink-subtle font-medium">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Application list */}
      <div className="bg-surface-1 rounded-lg border border-hairline overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
          <h2 className="font-medium text-ink tracking-[-0.4px]">Applications</h2>
          <Link href="/applications" className="text-sm text-primary hover:text-primary-hover transition-colors">
            View all
          </Link>
        </div>
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-ink-subtle text-sm">No applications yet</p>
            <Link href="/applications/new" className="mt-3 inline-block text-sm text-primary hover:text-primary-hover transition-colors">
              Add your first application
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {sorted.slice(0, 10).map(app => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink truncate">{app.role_title}</p>
                    {app.action_required && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        Action needed
                      </span>
                    )}
                    {isOverdue(app) && !['rejected','withdrawn','offer'].includes(app.status) && (
                      <span className="text-xs bg-surface-2 text-ink-subtle px-1.5 py-0.5 rounded font-medium">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-subtle truncate">{app.employer_name}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <StatusBadge status={(app.status as ApplicationStatus)} />
                  <span className="text-xs text-ink-tertiary">
                    {app.applied_date
                      ? new Date(app.applied_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : '—'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
