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

## Design System

The app uses the **Linear design system** — a near-pure-black canvas with a four-step dark surface ladder, lavender-blue accent, and hairline borders. All tokens are defined in `src/app/globals.css` via Tailwind v4's `@theme` directive.

### Token reference

| Token | Value | Usage |
|---|---|---|
| `bg-canvas` | `#010102` | Page background |
| `bg-surface-1` | `#0f1117` | Cards, panels |
| `bg-surface-2` | `#1a1d27` | Input fields, nested cards, hover rows |
| `bg-surface-3` | `#22263a` | Elevated UI inside surface-2 |
| `bg-surface-4` | `#2a2e45` | Tooltips, popovers |
| `border-hairline` | `#23252a` | Card borders |
| `border-hairline-strong` | `#2e3138` | Input borders (default), dividers |
| `bg-primary` / `text-primary` | `#5e6ad2` | CTA buttons, links, active indicators |
| `bg-primary-hover` | `#828fff` | Hover state for primary |
| `text-ink` | `#f7f8f8` | Primary text |
| `text-ink-muted` | `#d0d6e0` | Secondary text |
| `text-ink-subtle` | `#8a8f98` | Labels, placeholders |
| `text-ink-tertiary` | `#62666d` | Timestamps, captions |
| `text-success` / `bg-success` | `#27a644` | Interview, offer states |

### Input fields

All form inputs use a consistent class string — copy from any existing form rather than reinventing:

```
w-full rounded-md border border-hairline-strong bg-surface-2 px-3 py-2 text-sm text-ink
placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40
focus:border-primary/50 transition-colors
```

Inputs live on `bg-surface-1` cards, so `bg-surface-2` creates the visual inset. Never use `bg-surface-1` for inputs — they disappear against the card.

### Cards

Standard card shell: `bg-surface-1 rounded-lg border border-hairline`

Card section headers: `px-6 py-4 border-b border-hairline`

Card rows (lists): `px-6 py-4 hover:bg-surface-2 transition-colors`

### Navbar

`src/components/Navbar.tsx` — sticky, `bg-canvas/90 backdrop-blur-md border-b border-hairline`. Active links use `bg-surface-2 text-ink`; inactive use `text-ink-subtle hover:text-ink hover:bg-surface-1`. The notification badge uses `bg-primary` (not red).

### Status badges

`src/components/StatusBadge.tsx` — dark pill style. Key mappings:
- `interview` / `offer` → `bg-success/15 text-success`
- `action_required` → `bg-primary/10 text-primary`
- All others → `bg-surface-2 text-ink-muted` (or `text-ink-tertiary` for rejected/withdrawn)

### Auth pages

Auth pages (`/login`, `/register`) add `.auth-bg` to the outer wrapper for a subtle lavender radial glow. They do **not** use the `(app)` layout (no Navbar).

### Typography

- Page `<h1>`: `text-2xl font-semibold text-ink tracking-[-0.6px]`
- Auth brand `<h1>`: `text-3xl font-semibold text-ink tracking-[-1.0px]`
- Card section `<h2>`: `font-medium text-ink tracking-[-0.4px]`
- Field labels: `text-xs font-medium text-ink-subtle uppercase tracking-wide`
