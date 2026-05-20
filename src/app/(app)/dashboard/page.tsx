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
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here&apos;s your job search overview</p>
        </div>
        <Link
          href="/applications/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Application
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Active', value: stats.active, color: 'text-indigo-600' },
          { label: 'Interviews', value: stats.interviews, color: 'text-green-600' },
          { label: 'Offers', value: stats.offers, color: 'text-emerald-600' },
          { label: 'Action Required', value: stats.actionRequired, color: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Application list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Applications</h2>
          <Link href="/applications" className="text-sm text-indigo-600 hover:underline">View all</Link>
        </div>
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No applications yet</p>
            <Link href="/applications/new" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
              Add your first application
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.slice(0, 10).map(app => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{app.role_title}</p>
                    {app.action_required && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        Action needed
                      </span>
                    )}
                    {isOverdue(app) && !['rejected','withdrawn','offer'].includes(app.status) && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{app.employer_name}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <StatusBadge status={(app.status as ApplicationStatus)} />
                  <span className="text-xs text-gray-400">
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
