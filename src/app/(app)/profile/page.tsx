'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'executive']

const inputCls = 'w-full rounded-md border border-hairline-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [roleInput, setRoleInput] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    })
  }, [])

  function set(field: keyof Profile, value: unknown) {
    setProfile(p => ({ ...p, [field]: value }))
  }

  function addTag(field: 'skills' | 'target_roles', value: string, setter: (v: string) => void) {
    if (!value.trim()) return
    set(field, [...(profile[field] ?? []), value.trim()])
    setter('')
  }

  function removeTag(field: 'skills' | 'target_roles', index: number) {
    set(field, (profile[field] ?? []).filter((_, i) => i !== index))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({
      user_id: user!.id,
      full_name: profile.full_name ?? null,
      location: profile.location ?? null,
      phone: profile.phone ?? null,
      target_roles: profile.target_roles ?? [],
      experience_level: profile.experience_level ?? null,
      skills: profile.skills ?? [],
      preferred_language: profile.preferred_language ?? 'en',
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className="text-sm text-ink-subtle py-12 text-center">Loading profile…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Profile</h1>
        <p className="text-sm text-ink-subtle mt-1">Your personal information and job preferences</p>
      </div>

      <form onSubmit={handleSave} className="bg-surface-1 rounded-lg border border-hairline p-6 space-y-5">
        {saved && (
          <div className="rounded-md bg-success/10 border border-success/20 p-3 text-sm text-success">
            Profile saved successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-subtle mb-1">Full name</label>
            <input
              type="text" value={profile.full_name ?? ''} onChange={e => set('full_name', e.target.value)}
              className={inputCls} placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-subtle mb-1">Email</label>
            <input
              type="email" value={email} disabled
              className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink-tertiary cursor-not-allowed opacity-60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-subtle mb-1">Phone</label>
            <input
              type="tel" value={profile.phone ?? ''} onChange={e => set('phone', e.target.value)}
              className={inputCls} placeholder="+1 234 567 8900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-subtle mb-1">Location</label>
            <input
              type="text" value={profile.location ?? ''} onChange={e => set('location', e.target.value)}
              className={inputCls} placeholder="London, UK"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-subtle mb-1">Experience level</label>
          <select
            value={profile.experience_level ?? ''} onChange={e => set('experience_level', e.target.value)}
            className={inputCls}
          >
            <option value="">— Select level —</option>
            {EXPERIENCE_LEVELS.map(l => (
              <option key={l} value={l}>{l.replace(/^\w/, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-subtle mb-1">Target roles</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(profile.target_roles ?? []).map((role, i) => (
              <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
                {role}
                <button type="button" onClick={() => removeTag('target_roles', i)} className="hover:text-primary-hover">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={roleInput} onChange={e => setRoleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('target_roles', roleInput, setRoleInput) } }}
              className={inputCls} placeholder="e.g. Software Engineer"
            />
            <button
              type="button" onClick={() => addTag('target_roles', roleInput, setRoleInput)}
              className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm text-ink-subtle hover:text-ink transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-subtle mb-1">Skills</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(profile.skills ?? []).map((skill, i) => (
              <span key={i} className="flex items-center gap-1 bg-surface-2 text-ink-muted px-2 py-0.5 rounded-full text-xs">
                {skill}
                <button type="button" onClick={() => removeTag('skills', i)} className="hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('skills', skillInput, setSkillInput) } }}
              className={inputCls} placeholder="e.g. React, Python, SQL"
            />
            <button
              type="button" onClick={() => addTag('skills', skillInput, setSkillInput)}
              className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm text-ink-subtle hover:text-ink transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          type="submit" disabled={saving}
          className="w-full bg-primary hover:bg-primary-hover text-white rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}
