# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build — run this to catch errors before committing
npm run lint      # ESLint
npx tsc --noEmit  # Type-check without building
```

There are no tests yet. `npm run build` is the primary correctness check.

## Environment

`.env.local` must exist with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Both values point at the `wedtefzpbodltazhdxes` Supabase project (Singapore). The Supabase MCP server can be used to apply schema migrations and run SQL queries against it.

## Architecture

**Next.js 16, App Router, TypeScript, Tailwind CSS v4, Supabase.**

### Route groups

- `src/app/(app)/` — all protected pages (dashboard, applications, profile, resumes, notifications). The layout in this group renders `<Navbar>`.
- `src/app/login/` and `src/app/register/` — public auth pages, no layout.
- `src/app/api/` — API routes (`/auth/callback`, `/notifications/nudge`).

### Auth and route protection

Auth is enforced by `src/proxy.ts` — the Next.js 16 equivalent of `middleware.ts`. It exports a function named `proxy` (not `middleware`). It redirects unauthenticated users from protected paths to `/login`, and authenticated users away from `/login`/`/register` to `/dashboard`.

### Two Supabase clients

Always use the right one:

- **`src/lib/supabase/client.ts`** — browser/client components (`'use client'`). Call `createClient()` inside event handlers or `useEffect`, not at module level.
- **`src/lib/supabase/server.ts`** — server components and Route Handlers. Must be `await`ed: `const supabase = await createClient()`.

### Types

`src/types/database.ts` contains the Supabase-generated `Database` type (regenerate with the Supabase MCP `generate_typescript_types` tool when the schema changes). Domain aliases like `Application`, `Profile`, `Resume` etc. are exported from the bottom of that file.

The `status` column in `applications` is typed as `string` in the DB but treated as `ApplicationStatus` in the app — cast with `app.status as ApplicationStatus` when passing to `<StatusBadge>` or state.

Many date/nullable columns come back as `string | null` from Supabase. Guard with `column ? new Date(column) : null` before passing to `Date` constructors.

### Data patterns

- Server components fetch directly via the server client and pass typed data as props.
- Client components fetch inside `useEffect` or event handlers via the browser client.
- Timeline events are inserted alongside every status change (see `ApplicationActions.tsx`).
- Notifications are generated server-side via `POST /api/notifications/nudge` — intended to be called from a cron job.

### Supabase Storage

Resume files live in the `resumes` bucket. Files are stored at `{user_id}/{timestamp}.{ext}`. The bucket is public for reads; write/delete is RLS-gated to the owning user.
