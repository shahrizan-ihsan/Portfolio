'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const FEEDBACK_TYPES = ['rejection','interview_prep','offer','general','resume_tip']

export default function AddFeedbackForm({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('general')
  const [message, setMessage] = useState('')
  const [actions, setActions] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('feedback').insert({
      application_id: applicationId,
      feedback_type: type,
      message,
      suggested_actions: actions.split('\n').map(s => s.trim()).filter(Boolean),
    })
    setMessage('')
    setActions('')
    setOpen(false)
    setSaving(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-indigo-600 hover:underline"
      >
        + Add feedback note
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <select
          value={type} onChange={e => setType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {FEEDBACK_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
        <textarea
          required rows={3} value={message} onChange={e => setMessage(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="What happened? What did you learn?"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Suggested actions <span className="text-gray-400">(one per line)</span>
        </label>
        <textarea
          rows={2} value={actions} onChange={e => setActions(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="Follow up in 3 days&#10;Improve cover letter"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={() => setOpen(false)}
          className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
