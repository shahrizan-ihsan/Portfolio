'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Resume } from '@/types/database'

const CHANNELS = ['job_board','company_website','referral','linkedin','recruiter','other']

export default function NewApplicationPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    employer_name: '',
    role_title: '',
    status: 'submitted',
    applied_date: new Date().toISOString().split('T')[0],
    expected_next_update_date: '',
    channel: 'job_board',
    job_url: '',
    resume_id: '',
    notes: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('resumes').select('*').eq('user_id', user.id)
      setResumes(data ?? [])
    })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: app, error: err } = await supabase.from('applications').insert({
      user_id: user!.id,
      employer_name: form.employer_name,
      role_title: form.role_title,
      status: form.status,
      applied_date: form.applied_date || null,
      expected_next_update_date: form.expected_next_update_date || null,
      channel: form.channel || null,
      job_url: form.job_url || null,
      resume_id: form.resume_id || null,
      notes: form.notes || null,
    }).select().single()
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    // Add initial timeline event
    await supabase.from('application_timeline_events').insert({
      application_id: app.id,
      status: form.status,
      title: `Application ${form.status === 'submitted' ? 'submitted' : 'created'}`,
      description: `Applied for ${form.role_title} at ${form.employer_name}`,
    })
    router.push(`/applications/${app.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Application</h1>
        <p className="text-sm text-gray-500 mt-1">Log a new job application</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
            <input
              required value={form.employer_name} onChange={e => set('employer_name', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job title *</label>
            <input
              required value={form.role_title} onChange={e => set('role_title', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Software Engineer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['drafted','submitted','acknowledged','under_review','action_required','interview','rejected','offer','withdrawn'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select
              value={form.channel} onChange={e => set('channel', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CHANNELS.map(c => (
                <option key={c} value={c}>{c.replace('_', ' ').replace(/^\w/, x => x.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date applied</label>
            <input
              type="date" value={form.applied_date} onChange={e => set('applied_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expect update by</label>
            <input
              type="date" value={form.expected_next_update_date} onChange={e => set('expected_next_update_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
          <input
            type="url" value={form.job_url} onChange={e => set('job_url', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://..."
          />
        </div>

        {resumes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resume used</label>
            <select
              value={form.resume_id} onChange={e => set('resume_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— None —</option>
              {resumes.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Any notes about this application…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit" disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Application'}
          </button>
          <button
            type="button" onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
