'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const FEEDBACK_TYPES = ['rejection','interview_prep','offer','general','resume_tip']

const inputCls = 'w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-hairline-strong resize-none'

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
      <button onClick={() => setOpen(true)} className="text-sm text-primary hover:text-primary-hover transition-colors">
        + Add feedback note
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-hairline rounded-lg p-4 bg-surface-2">
      <div>
        <label className="block text-xs font-medium text-ink-subtle mb-1">Type</label>
        <select
          value={type} onChange={e => setType(e.target.value)}
          className={inputCls}
        >
          {FEEDBACK_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-subtle mb-1">Note</label>
        <textarea
          required rows={3} value={message} onChange={e => setMessage(e.target.value)}
          className={inputCls}
          placeholder="What happened? What did you learn?"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-subtle mb-1">
          Suggested actions <span className="text-ink-tertiary">(one per line)</span>
        </label>
        <textarea
          rows={2} value={actions} onChange={e => setActions(e.target.value)}
          className={inputCls}
          placeholder="Follow up in 3 days&#10;Improve cover letter"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={() => setOpen(false)}
          className="px-4 py-1.5 rounded-md border border-hairline text-sm text-ink-subtle hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
