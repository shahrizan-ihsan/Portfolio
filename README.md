# JobTrack — Job Application Tracker MVP

A full-stack web app for tracking job applications, built with Next.js 16 + Supabase.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript)
- **Database + Auth + Storage**: Supabase (PostgreSQL, RLS, Storage)
- **Styling**: Tailwind CSS v4

## Features (MVP)

| Milestone | Status |
|-----------|--------|
| User registration & login | ✅ |
| User profile (skills, target roles, experience) | ✅ |
| Resume upload (PDF/DOC) | ✅ |
| Manual application logging | ✅ |
| Application dashboard with stats | ✅ |
| Status updates with timeline | ✅ |
| Feedback notes per application | ✅ |
| In-app notifications | ✅ |
| Stale application nudge API | ✅ |

## Application Statuses

`Drafted → Submitted → Acknowledged → Under Review → Action Required → Interview → Offer / Rejected / Withdrawn`

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. `.env.local` is already configured pointing at the Supabase project.

3. Run dev server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
  app/
    (app)/                  # Protected routes (auth required)
      dashboard/            # Overview + stats
      applications/         # List, [id] detail, new
      profile/              # User profile editor
      resumes/              # Resume upload/management
      notifications/        # In-app notifications
    api/
      auth/callback/        # Supabase OAuth callback
      notifications/nudge/  # POST: generate stale-app nudges
    login/
    register/
  components/
    Navbar.tsx
    StatusBadge.tsx
  lib/supabase/
    client.ts               # Browser client
    server.ts               # Server/RSC client
  types/database.ts         # Supabase-generated types + aliases
  proxy.ts                  # Auth guard (Next.js 16 proxy)
```

## Database Schema

Tables: `profiles`, `resumes`, `applications`, `application_timeline_events`, `feedback`, `notifications`

All tables use Row Level Security — users can only access their own data.

## Nudge Notifications

POST `/api/notifications/nudge` generates in-app notifications for any active application not updated in 7+ days. Wire up to a cron job (Vercel Cron, Supabase Edge Function, etc.) for automated reminders.

## Deployment

Deploy to Vercel — set the two `NEXT_PUBLIC_SUPABASE_*` environment variables and push.
