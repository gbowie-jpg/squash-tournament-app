# Seattle Squash Tournament Companion App

Real-time tournament management and communication platform for the Seattle Squash Racquets Association (SSRA). Built to fill the gap Club Locker leaves on tournament day — live court boards, player schedules, announcements, email marketing, and volunteer coordination.

**Live:** squash-tournament-app.vercel.app  
**Owner:** Geof Bowie

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
- **Supabase** — Postgres, Auth, Realtime
- **Tailwind CSS v4**
- **Resend** — transactional email
- **Web Push / VAPID** — browser push notifications
- **Vercel** — deployment (auto-deploys on push to `main`)

---

## Running Migrations

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked -f supabase/your-migration.sql
```

Migration files live in `supabase/`.

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
- **Live court board** — see what's happening on every court in real time
- **Player lookup** — find your matches by name
- **Announcements** — urgent and normal updates from the organizer

### For Organizers (Admin)
- **Match management** — assign courts, update status, enter scores
- **Draw generation** — create brackets, auto-schedule matches
- **Email marketing** — per-tournament and global campaigns via Resend
- **Push notifications** — browser push to all subscribed users
- **Volunteer management** — public signup creates auth account
- **Site content editor** — homepage hero image, gradient, text color
- **Tournament appearance** — per-tournament hero image, background, gradient, text

### PWA
- Installable on iOS and Android (Add to Home Screen)
- Service worker caches app shell
- Push notifications via VAPID

---

## URL Structure

```
/                        Homepage (tournament list)
/t/[slug]                Tournament landing page
/t/[slug]/courts         Live court board
/t/[slug]/players        Player lookup
/t/[slug]/volunteer      Volunteer signup
/admin                   Admin dashboard
/admin/tournaments       Manage tournaments
/admin/content           Homepage & tournament graphics
/admin/email             Global email marketing
/admin/settings          Integrations & config reference
/t/[slug]/admin          Tournament admin dashboard
/t/[slug]/admin/settings Tournament appearance + details
/t/[slug]/admin/email    Tournament email marketing
```
