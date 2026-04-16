# Seattle Squash Tournament Companion App

Real-time tournament management and communication platform for the Seattle Squash Racquets Association (SSRA). Built to fill the gap Club Locker leaves on tournament day — live court boards, player schedules, live scoring, announcements, email marketing, and volunteer coordination.

**Live:** squash-tournament-app.vercel.app  
**Owner:** Geof Bowie (gbowie@gmail.com)

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

### Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

---

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Supabase** — Postgres, Auth, Realtime, Storage
- **Tailwind CSS v4**
- **Resend** — transactional email
- **Web Push / VAPID** — browser push notifications
- **Vercel** — deployment (auto-deploys on push to `main`)

---

## Supabase Setup

### Storage Buckets

Two public buckets required:

| Bucket | Purpose |
|--------|---------|
| `tournament-images` | Tournament hero/logo images (manual upload via dashboard) |
| `player-videos` | Player highlight video uploads (created via migration) |

To create `player-videos` bucket (if not already exists):
```bash
curl -X POST https://<project-ref>.supabase.co/storage/v1/bucket \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"id":"player-videos","name":"player-videos","public":true}'
```

### Auth Redirect URLs

Add these in Supabase Dashboard → Authentication → URL Configuration:
- `https://squash-tournament-app.vercel.app/**`
- `http://localhost:3000/**`

### Running Migrations

Run SQL files in `supabase/` via Supabase Dashboard → SQL Editor (or Management API).

---

## Project Docs

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Full context for AI assistants — architecture, conventions, working preferences |
| `DATA-MODEL.md` | Complete Supabase schema with all columns |
| `USER-GUIDE.md` | Admin user guide — how to run a tournament |
| `MVP-SPEC.md` | Original feature spec (historical reference) |

---

## Key Features

### For Players / Public
- **Tournament landing page** — countdown timer, schedule, venue, contact info
- **Live court board** — real-time court grid via Supabase Realtime
- **Player lookup** — find matches by name, view full draw sheet
- **Player profile** — personal match history + highlight video uploads
- **Announcements** — urgent and normal updates from the organizer
- **Volunteer signup** — public form to sign up as referee, volunteer, or helper

### For Scorers
- **Full scoring app** — 4-step flow: confirm → serve selection → warmup → live scoring
- PAR scoring (games to 11, win by 2, best of 5)
- Auto game/match detection, 90-second break overlay, serve indicator

### For Organizers (Admin)
- **Match management** — list view + schedule view (per-court columns), inline time edit, quick court move
- **Draw generation** — create brackets, auto-schedule matches
- **Court management** — add courts, auto-assign matches
- **Player video approvals** — approve/reject player highlight clips with reason
- **Email marketing** — per-tournament and global campaigns via Resend
- **Push notifications** — browser push to all subscribed users
- **Volunteer management** — view signups, assign referees to matches, auto-assign by round priority
- **Site content editor** — homepage hero image, gradient, text color
- **Tournament appearance** — per-tournament hero image, background, gradient, text

### PWA
- Installable on iOS and Android (Add to Home Screen)
- Service worker caches app shell
- Push notifications via VAPID

---

## URL Structure

```
/                              Homepage (tournament list)
/login                         Sign in / sign up / reset password
/account                       User profile (name, club, ranking, photo, password)
/account/reset-password        Password reset landing (from email link)

/t/[slug]                      Tournament landing page
/t/[slug]/courts               Live court board (Supabase Realtime)
/t/[slug]/players              Player lookup + draw sheet
/t/[slug]/announcements        Public announcements feed
/t/[slug]/volunteer            Public volunteer/referee signup
/t/[slug]/player/[id]          Player profile (matches + video highlights)
/t/[slug]/match/[id]           Match detail
/t/[slug]/match/[id]/score     Scoring app (4-step flow)

/t/[slug]/admin                Tournament admin dashboard
/t/[slug]/admin/matches        Match management (list + schedule views)
/t/[slug]/admin/courts         Court management + auto-assign
/t/[slug]/admin/players        Player management + CSV import
/t/[slug]/admin/draws          Draw generation + scheduling
/t/[slug]/admin/announcements  Announcements + push notifications
/t/[slug]/admin/volunteers     Volunteer/referee management + auto-assign
/t/[slug]/admin/videos         Player video approval queue
/t/[slug]/admin/email          Tournament email marketing
/t/[slug]/admin/settings       Tournament appearance + details

/admin                         Top-level admin dashboard
/admin/tournaments             Create/manage tournaments
/admin/content                 Homepage hero + tournament graphics
/admin/email                   Global email marketing
/admin/settings                Integrations + env var reference
/admin/users                   User management (superadmin only)
```
