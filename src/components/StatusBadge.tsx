'use client'
import type { ApplicationStatus } from '@/types/database'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  drafted:        { label: 'Drafted',        className: 'bg-gray-100 text-gray-700' },
  submitted:      { label: 'Submitted',      className: 'bg-blue-100 text-blue-700' },
  acknowledged:   { label: 'Acknowledged',   className: 'bg-cyan-100 text-cyan-700' },
  under_review:   { label: 'Under Review',   className: 'bg-purple-100 text-purple-700' },
  action_required:{ label: 'Action Required',className: 'bg-amber-100 text-amber-700' },
  interview:      { label: 'Interview',      className: 'bg-green-100 text-green-700' },
  rejected:       { label: 'Rejected',       className: 'bg-red-100 text-red-700' },
  offer:          { label: 'Offer',          className: 'bg-emerald-100 text-emerald-700' },
  withdrawn:      { label: 'Withdrawn',      className: 'bg-zinc-100 text-zinc-500' },
}

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
