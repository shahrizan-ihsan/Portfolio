'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Application, ApplicationStatus } from '@/types/database'

const STATUSES: ApplicationStatus[] = [
  'drafted','submitted','acknowledged','under_review',
  'action_required','interview','rejected','offer','withdrawn',
]

const inputCls = 'w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-hairline-strong'

export default function ApplicationActions({ application }: { application: Application }) {
  const router = useRouter()
  const [status, setStatus] = useState<ApplicationStatus>((application.status as ApplicationStatus) ?? 'submitted')
  const [actionRequired, setActionRequired] = useState(application.action_required ?? false)
  const [expectedDate, setExpectedDate] = useState(application.expected_next_update_date ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleUpdate() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('applications').update({
      status,
      action_required: actionRequired,
      expected_next_update_date: expectedDate || null,
    }).eq('id', application.id)

    if (status !== application.status) {
      await supabase.from('application_timeline_events').insert({
        application_id: application.id,
        status,
        title: `Status changed to ${status.replace('_', ' ')}`,
      })
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this application? This cannot be undone.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('applications').delete().eq('id', application.id)
    router.push('/applications')
  }

  return (
    <div className="bg-surface-1 rounded-lg border border-hairline p-6 space-y-4">
      <h2 className="font-medium text-ink tracking-[-0.4px]">Update Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-subtle mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ApplicationStatus)}
            className={inputCls}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-subtle mb-1">Expect update by</label>
          <input
            type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <input
              type="checkbox" checked={actionRequired} onChange={e => setActionRequired(e.target.checked)}
              className="rounded border-hairline bg-surface-2 text-primary focus:ring-primary/50"
            />
            <span className="text-sm text-ink-muted">Action required</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleUpdate} disabled={saving}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={handleDelete} disabled={deleting}
          className="px-4 py-2 rounded-md border border-hairline text-ink-subtle hover:border-red-400 hover:text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
