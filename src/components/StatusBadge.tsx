'use client'
import type { ApplicationStatus } from '@/types/database'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  drafted:         { label: 'Drafted',         className: 'bg-surface-2 text-ink-subtle' },
  submitted:       { label: 'Submitted',        className: 'bg-surface-2 text-ink-muted' },
  acknowledged:    { label: 'Acknowledged',     className: 'bg-surface-2 text-ink-muted' },
  under_review:    { label: 'Under Review',     className: 'bg-surface-2 text-ink-muted' },
  action_required: { label: 'Action Required',  className: 'bg-primary/10 text-primary' },
  interview:       { label: 'Interview',        className: 'bg-success/15 text-success' },
  rejected:        { label: 'Rejected',         className: 'bg-surface-2 text-ink-tertiary' },
  offer:           { label: 'Offer',            className: 'bg-success/15 text-success' },
  withdrawn:       { label: 'Withdrawn',        className: 'bg-surface-2 text-ink-tertiary' },
}

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-surface-2 text-ink-subtle' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
