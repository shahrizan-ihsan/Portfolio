import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import type { Application, ApplicationStatus } from '@/types/database'

const ALL_STATUSES: ApplicationStatus[] = [
  'drafted','submitted','acknowledged','under_review',
  'action_required','interview','rejected','offer','withdrawn',
]

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('applications')
    .select('*')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  if (status && ALL_STATUSES.includes(status as ApplicationStatus)) {
    query = query.eq('status', status)
  }

  const { data } = await query
  const applications = (data ?? []) as Application[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Applications</h1>
        <Link
          href="/applications/new"
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + Add Application
        </Link>
      </div>

      {/* Filter tabs — Linear pricing-tab pattern */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/applications"
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !status
              ? 'bg-surface-2 border border-hairline-strong text-ink'
              : 'bg-surface-1 border border-hairline text-ink-subtle hover:text-ink'
          }`}
        >
          All
        </Link>
        {ALL_STATUSES.map(s => (
          <Link
            key={s}
            href={`/applications?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              status === s
                ? 'bg-surface-2 border border-hairline-strong text-ink'
                : 'bg-surface-1 border border-hairline text-ink-subtle hover:text-ink'
            }`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="bg-surface-1 rounded-lg border border-hairline overflow-hidden">
        {applications.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-ink-subtle text-sm">No applications found</p>
            <Link href="/applications/new" className="mt-3 inline-block text-sm text-primary hover:text-primary-hover transition-colors">
              Add your first application
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {applications.map(app => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink truncate">{app.role_title}</p>
                    {app.action_required && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Action needed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-sm text-ink-subtle">{app.employer_name}</p>
                    {app.channel && (
                      <span className="text-xs text-ink-tertiary capitalize">{app.channel.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <StatusBadge status={(app.status as ApplicationStatus)} />
                  <span className="text-xs text-ink-tertiary w-16 text-right">
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
