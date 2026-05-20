'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Resume } from '@/types/database'

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  async function loadResumes() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('resumes').select('*').eq('user_id', user!.id).order('uploaded_at', { ascending: false })
    setResumes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadResumes() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !label.trim()) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ext = file.name.split('.').pop()
    const path = `${user!.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('resumes').upload(path, file)
    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(path)
    await supabase.from('resumes').insert({
      user_id: user!.id,
      label: label.trim(),
      file_name: file.name,
      file_url: publicUrl,
    })
    setLabel('')
    setFile(null)
    setUploading(false)
    loadResumes()
  }

  async function handleDelete(resume: Resume) {
    if (!confirm(`Delete "${resume.label}"?`)) return
    const supabase = createClient()
    const path = resume.file_url.split('/resumes/')[1]
    if (path) await supabase.storage.from('resumes').remove([path])
    await supabase.from('resumes').delete().eq('id', resume.id)
    setResumes(r => r.filter(x => x.id !== resume.id))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumes</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage your resumes</p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Upload Resume</h2>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text" required value={label} onChange={e => setLabel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Software Engineer CV 2025"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, DOC, DOCX)</label>
          <input
            type="file" required accept=".pdf,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-sm file:font-medium"
          />
        </div>
        <button
          type="submit" disabled={uploading || !file}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload Resume'}
        </button>
      </form>

      {/* Resume list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Your Resumes</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : resumes.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No resumes uploaded yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {resumes.map(r => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.file_name} · Uploaded {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={r.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(r)}
                    className="text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
