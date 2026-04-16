<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-conventions -->
# Project Conventions for AI Agents

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase

## Critical Rules

### Styling
- **Never** hardcode `bg-white`, `bg-zinc-50`, `text-zinc-700`, `border-zinc-200`, etc.
- **Always** use CSS var tokens: `bg-[var(--surface)]`, `bg-[var(--surface-card)]`, `border-[var(--border)]`, `text-[var(--text-primary)]`, `text-[var(--text-secondary)]`, `text-[var(--text-muted)]`
- For conditional colors (e.g. state-dependent backgrounds), use **inline styles** — Tailwind JIT may purge conditional classes

### Data
- Convert empty strings to `null` before PATCH requests to Supabase
- Use `force-dynamic` on server components that read frequently-changing data

### Auth
- `requireAuth()` returns `{ user: { id, email } }` — not `{ userId }`
- Roles stored in `profiles.role`: `user` | `admin` | `superadmin`

### TypeScript
- Run `npx tsc --noEmit` to check types (ignore `.next/types/` errors — those are generated)

## File Locations
- DB types: `src/lib/supabase/types.ts`
- Supabase browser client: `src/lib/supabase/client.ts`
- Supabase server client: `src/lib/supabase/server.ts`
- Supabase admin client (service role): `src/lib/supabase/admin.ts`
- Auth check helper: `src/lib/supabase/auth-check.ts`
- Draw progression logic: `src/lib/draws/progression.ts`
<!-- END:project-conventions -->
