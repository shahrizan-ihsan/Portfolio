'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Application, ApplicationStatus } from '@/types/database'

const STATUSES: ApplicationStatus[] = [
  'drafted','submitted','acknowledged','under_review',
  'action_required','interview','rejected','offer','withdrawn',
]

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
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Update Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ApplicationStatus)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expect update by</label>
          <input
            type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <input
              type="checkbox" checked={actionRequired} onChange={e => setActionRequired(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Action required</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleUpdate} disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={handleDelete} disabled={deleting}
          className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
