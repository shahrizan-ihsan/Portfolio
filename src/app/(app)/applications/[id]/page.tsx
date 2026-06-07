import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import ApplicationActions from './ApplicationActions'
import AddFeedbackForm from './AddFeedbackForm'
import type { Application, ApplicationTimelineEvent, Feedback, ApplicationStatus } from '@/types/database'

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: app }, { data: timeline }, { data: feedbackRows }] = await Promise.all([
    supabase.from('applications').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('application_timeline_events').select('*').eq('application_id', id).order('occurred_at', { ascending: false }),
    supabase.from('feedback').select('*').eq('application_id', id).order('created_at', { ascending: false }),
  ])

  if (!app) notFound()

  const application = app as Application
  const events = (timeline ?? []) as ApplicationTimelineEvent[]
  const feedbackList = (feedbackRows ?? []) as Feedback[]
  const status = (application.status as ApplicationStatus) ?? 'submitted'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-sm text-ink-tertiary hover:text-ink-subtle transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        All applications
      </Link>

      {/* Header */}
      <div className="bg-surface-1 rounded-lg border border-hairline p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink tracking-[-0.4px]">{application.role_title}</h1>
            <p className="text-ink-subtle mt-0.5">{application.employer_name}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatusBadge status={status} />
              {application.action_required && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Action Required
                </span>
              )}
              {application.channel && (
                <span className="text-xs text-ink-tertiary capitalize">{application.channel.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-ink-subtle shrink-0">
            {application.applied_date && (
              <p>Applied: <span className="text-ink font-medium">
                {new Date(application.applied_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span></p>
            )}
            {application.expected_next_update_date && (
              <p className="mt-1">Expect update: <span className={`font-medium ${
                new Date(application.expected_next_update_date) < new Date() ? 'text-red-400' : 'text-ink'
              }`}>
                {new Date(application.expected_next_update_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span></p>
            )}
            {application.job_url && (
              <a href={application.job_url} target="_blank" rel="noopener noreferrer"
                className="mt-1 block text-primary hover:text-primary-hover transition-colors">
                View listing →
              </a>
            )}
          </div>
        </div>
        {application.notes && (
          <div className="mt-4 pt-4 border-t border-hairline">
            <p className="text-sm text-ink-muted">{application.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <ApplicationActions application={application} />

      {/* Timeline */}
      <div className="bg-surface-1 rounded-lg border border-hairline p-6">
        <h2 className="font-medium text-ink mb-4 tracking-[-0.4px]">Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-subtle">No events yet</p>
        ) : (
          <ol className="relative border-l border-hairline space-y-4 ml-2">
            {events.map(event => (
              <li key={event.id} className="pl-5 relative">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-surface-1" />
                <p className="text-sm font-medium text-ink">{event.title}</p>
                {event.description && <p className="text-sm text-ink-subtle">{event.description}</p>}
                <p className="text-xs text-ink-tertiary mt-0.5">
                  {event.occurred_at
                    ? new Date(event.occurred_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Feedback */}
      <div className="bg-surface-1 rounded-lg border border-hairline p-6">
        <h2 className="font-medium text-ink mb-4 tracking-[-0.4px]">Feedback & Notes</h2>
        {feedbackList.length > 0 && (
          <div className="space-y-3 mb-4">
            {feedbackList.map(f => (
              <div key={f.id} className="rounded-lg bg-surface-2 border border-hairline p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary capitalize">
                    {f.feedback_type?.replace('_', ' ') ?? 'Note'}
                  </span>
                  <span className="text-xs text-ink-tertiary">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">{f.message}</p>
                {f.suggested_actions && f.suggested_actions.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {f.suggested_actions.map((action, i) => (
                      <li key={i} className="text-xs text-ink-subtle flex items-start gap-1">
                        <span className="text-primary mt-0.5">→</span> {action}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <AddFeedbackForm applicationId={id} />
      </div>
    </div>
  )
}
