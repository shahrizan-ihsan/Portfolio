import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
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
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{application.role_title}</h1>
            <p className="text-gray-500 mt-0.5">{application.employer_name}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatusBadge status={status} />
              {application.action_required && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Action Required
                </span>
              )}
              {application.channel && (
                <span className="text-xs text-gray-400 capitalize">{application.channel.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 shrink-0">
            {application.applied_date && (
              <p>Applied: <span className="text-gray-700 font-medium">
                {new Date(application.applied_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span></p>
            )}
            {application.expected_next_update_date && (
              <p className="mt-1">Expect update: <span className={`font-medium ${
                new Date(application.expected_next_update_date) < new Date() ? 'text-red-600' : 'text-gray-700'
              }`}>
                {new Date(application.expected_next_update_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span></p>
            )}
            {application.job_url && (
              <a href={application.job_url} target="_blank" rel="noopener noreferrer"
                className="mt-1 block text-indigo-600 hover:underline">
                View listing →
              </a>
            )}
          </div>
        </div>
        {application.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">{application.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <ApplicationActions application={application} />

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No events yet</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-4 ml-2">
            {events.map(event => (
              <li key={event.id} className="pl-5 relative">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                {event.description && <p className="text-sm text-gray-500">{event.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Feedback & Notes</h2>
        {feedbackList.length > 0 && (
          <div className="space-y-3 mb-4">
            {feedbackList.map(f => (
              <div key={f.id} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-indigo-600 capitalize">
                    {f.feedback_type?.replace('_', ' ') ?? 'Note'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{f.message}</p>
                {f.suggested_actions && f.suggested_actions.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {f.suggested_actions.map((action, i) => (
                      <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                        <span className="text-indigo-400 mt-0.5">→</span> {action}
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
