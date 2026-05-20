import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Called to generate "no update" nudge notifications for stale applications
export async function POST() {
  const supabase = await createClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: stale } = await supabase
    .from('applications')
    .select('id, user_id, role_title, employer_name, updated_at')
    .not('status', 'in', '("rejected","withdrawn","offer")')
    .lt('updated_at', sevenDaysAgo.toISOString())

  if (!stale?.length) return NextResponse.json({ notified: 0 })

  const notifications = stale.map(app => ({
    user_id: app.user_id,
    type: 'stale_application',
    title: 'Application needs an update',
    message: `No update on ${app.role_title} at ${app.employer_name} for 7+ days. Log your latest status.`,
    related_application_id: app.id,
  }))

  await supabase.from('notifications').insert(notifications)
  return NextResponse.json({ notified: stale.length })
}
