# Seattle Squash Tournament App — Claude Code Context

## What This Is

Real-time tournament companion app for **SSRA (Seattle Squash Racquets Association)**.
Deployed at **squash-tournament-app.vercel.app** (Vercel, auto-deploys on push to `main`).
Supabase project ref: **rhrkkwvrehntnqqadehq**

**This is NOT a Club Locker replacement.** Club Locker handles registration, draws, and seeding. This fills the gap Club Locker ignores: live communication and management during the tournament day. Strategy: companion app now, absorb Club Locker functions over time.

**Owner:** Geof Bowie (gbowie@gmail.com). Personal project, not FASTSIGNS work.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email/password + magic link + password reset) |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage (`tournament-images` bucket, `player-videos` bucket) |
| Deployment | Vercel (auto-deploy on push to main) |
| Email | Resend API |
| Push notifications | Web Push / VAPID |
| PWA | manifest.json + custom service worker |

---

## Key Commands

```bash
npm run dev       # start dev server on localhost:3000
npm run build     # production build
npx tsc --noEmit  # type check (ignore .next/types/ errors — those are generated)
```

**Run migrations:** SQL migrations in `supabase/` — run via Supabase dashboard SQL editor or Management API.

---

## Environment Variables

Required in `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

VAPID keys (already generated and set):
- Public: `BOmOGJHaXQcsUPcQLFK60yaXXqeDf3B11ilJPzqGSNtODW69GsArKVoIGE4-ibqLtu4-_7JjyxvuLzNXObL1-bc`
- Private: `xOqjO3aHTLIOXRgQR5B535IIxA5gzZK4b9US04qvIbc`

Auth redirect URLs configured in Supabase:
- `https://squash-tournament-app.vercel.app/**`
- `http://localhost:3000/**`

---

## Project Structure

```
src/
  app/
    page.tsx                          # Homepage — tournament list + hero
    layout.tsx                        # Root layout — ThemeProvider, NavigationLoadingBar, manifest
    not-found.tsx                     # Custom 404
    login/page.tsx                    # Sign in / Sign up / Password reset
    account/
      page.tsx                        # User profile — name, club, ranking, photo, change password
      reset-password/page.tsx         # Password reset landing (handles Supabase recovery token)
    admin/
      page.tsx                        # Top-level admin dashboard
      tournaments/page.tsx            # Create/manage tournaments (dark theme)
      content/page.tsx                # Homepage hero + tournament graphics editor
      email/page.tsx                  # Global email marketing (tag-based)
      settings/page.tsx               # Integrations, env vars, URL reference
      users/page.tsx                  # User management (superadmin)
    t/[slug]/
      page.tsx                        # Public tournament landing page
      courts/page.tsx                 # Live court board (real-time)
      players/page.tsx                # Player lookup / draw sheet
      announcements/page.tsx          # Public announcements feed
      volunteer/page.tsx              # Public volunteer signup (creates auth account)
      player/[playerId]/page.tsx      # Player profile — matches + highlight video upload
      match/[matchId]/page.tsx        # Match detail — status, score, players, CTA to score
      match/[matchId]/score/page.tsx  # Full scoring app (4-step flow)
      admin/
        page.tsx                      # Tournament admin dashboard
        matches/page.tsx              # Match management — list + schedule view
        courts/page.tsx               # Court management + auto-assign
        players/page.tsx              # Player management + CSV import
        draws/page.tsx                # Draw generation + scheduling
        announcements/page.tsx        # Announcement composer + push notifications
        volunteers/page.tsx           # Volunteer/referee management
        videos/page.tsx               # Player highlight video approval queue
        email/page.tsx                # Tournament email marketing
        settings/page.tsx             # Tournament settings (hero, contact, schedule, etc.)
  api/
    tournaments/route.ts              # GET all / POST create
    tournaments/[id]/route.ts         # GET/PATCH/DELETE tournament
    tournaments/[id]/players/route.ts
    tournaments/[id]/matches/route.ts # includes winner progression + on_deck logic
    tournaments/[id]/courts/route.ts
    tournaments/[id]/announcements/route.ts
    tournaments/[id]/volunteers/route.ts
    tournaments/[id]/videos/route.ts  # GET/POST/PATCH/DELETE player videos
    tournaments/[id]/email/route.ts
    tournaments/[id]/referees/assign/route.ts
    site-settings/route.ts
    auth/me/route.ts
    account/profile/route.ts
    account/photo/route.ts
    push/subscribe/route.ts
    push/send/route.ts
    email/route.ts
  components/
    layout/
      SiteNav.tsx                     # Top nav — logo, links, AuthButton (role-aware), PushManager
      AuthButton.tsx                  # Shows 'Dashboard' → /admin for admins, 'My Account' for others
      SiteFooter.tsx
      TournamentBottomNav.tsx         # Mobile bottom nav on tournament pages
    NavigationLoadingBar.tsx          # Click-based progress bar for client navigation
    PullToRefresh.tsx                 # Pull-to-refresh on mobile tournament pages
    RefreshButton.tsx                 # Manual refresh button (header)
    ThemeToggle.tsx                   # Light/dark toggle (moon/sun icon)
    CountdownTimer.tsx
    InfoAccordion.tsx
    PushManager.tsx
    ServiceWorkerRegistrar.tsx
    admin/CsvUpload.tsx
  lib/
    supabase/
      client.ts                       # Browser Supabase client
      server.ts                       # Server Supabase client
      admin.ts                        # Admin client (service role)
      types.ts                        # DB types — keep in sync with schema
      auth-check.ts                   # requireAuth() helper
    realtime/hooks.ts                 # useRealtimeMatches() — Supabase Realtime subscription
    gradients.ts                      # GRADIENT_PRESETS, TEXT_COLOR_PRESETS, heroBackground()
    useTournament.ts                  # Client hook: fetch tournament by slug
    useAuth.ts                        # Client hook: Supabase auth state + signOut
    email.ts                          # Resend integration
    utils.ts                          # slugify(), formatScore(), etc.
  public/
    manifest.json                     # PWA manifest
    sw.js                             # Service worker (caching + push handling)
    logo.png
```

---

## Dark Theme System

**Tailwind v4** — uses `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`.

**CSS variable tokens** (defined for both light and dark in `globals.css`):
- `--surface` — page background
- `--surface-card` — card/panel background
- `--border` — border color
- `--text-primary`, `--text-secondary`, `--text-muted` — text hierarchy
- `--nav-bg` — nav bar (always dark)

**ThemeProvider** in root layout reads `localStorage` and sets `.dark` class on `<html>`.
Inline script in `<head>` prevents flash on load.
**ThemeToggle** component available on every page.

**Important:** For conditional colors that depend on state (e.g. scoring app `isServing` highlight), use **inline styles** instead of Tailwind classes — Tailwind JIT may purge conditional classes. Example:
```tsx
style={{ background: isServing ? '#2563eb' : '#27272a' }}
```

---

## Scoring App (`/t/[slug]/match/[matchId]/score`)

4-step flow:

1. **Confirm** — verify players, draw/round, select court
2. **Serve** — choose who serves first + court sides (Left/Right)
3. **Warmup** — 5-minute countdown (WSF Rule 4). Start/Skip/Start Match.
4. **Scoring** — live point-by-point

Scoring rules (US Squash / WSF):
- PAR scoring: every rally scores a point
- Games to 11, win by 2 (if 10-all, play to 12)
- Best of 5 (first to win 3 games)
- 90-second break between games (WSF Rule 14.1)
- Auto-records game when winner reaches 11 with 2+ point lead
- Auto-records match when player wins 3 games
- Serve bar at top (h-14): tap to switch server
- Serving player panel gets `outline: 2px solid #3b82f6` highlight

**`saveRef` pattern** used to avoid stale closures:
```ts
const saveRef = useRef<typeof saveScores>();
saveRef.current = saveScores;
// inside adjustScore: saveRef.current?.()
```

---

## Data Model Summary

Full schema in `DATA-MODEL.md`. Core tables:

| Table | Purpose |
|-------|---------|
| `tournaments` | Top-level container |
| `courts` | Physical courts per tournament |
| `players` | Participants (no auth required) |
| `matches` | Core — status, scores, court, referee |
| `announcements` | Organizer messages |
| `volunteers` | Signup data — role: referee/volunteer/helper |
| `player_videos` | Player highlight clips — pending/approved/rejected |
| `email_recipients` | Per-tournament marketing list |
| `email_campaigns` | Sent campaigns |
| `email_sends` | Per-recipient send records |
| `push_subscriptions` | VAPID push endpoint data |
| `site_settings` | Key/value — homepage content |
| `profiles` | Extended user data — name, club, ranking, photo, role |
| `organizers` | Per-tournament admin/scorer access |

---

## Auth & Roles

**Roles** (stored in `profiles.role`):
- `user` — default
- `admin` — can manage tournaments
- `superadmin` — can also manage users

**Auth flows:**
- Email/password sign in
- Sign up → confirm email → sign in
- "Forgot password?" → `resetPasswordForEmail` → email → `/account/reset-password` (sets new password via `supabase.auth.updateUser`)
- Account profile page has "Change Password" section for users signed in via any method

**AuthButton in nav:**
- Logged out → "Sign In" → `/login`
- Logged in + admin/superadmin → "Dashboard" → `/admin`
- Logged in + regular user → "My Account" → `/account`

---

## Match Status Flow

```
scheduled → on_deck → in_progress → completed
                                   → walkover
                  → cancelled
```

When a match moves to `in_progress`, the next `scheduled` match on the same court automatically moves to `on_deck`.

When a match is completed with a winner, the winner is automatically progressed to the next round match (via `getProgression()` in `src/lib/draws/progression.ts`).

---

## Player Videos

Supabase Storage bucket: `player-videos` (public).

Flow:
1. Player uploads from their profile page → stored at `{playerId}/{timestamp}.{ext}` in Storage
2. DB record created with `status: 'pending'`
3. Admin sees pending videos at `/t/[slug]/admin/videos` — preview, approve, or reject with reason
4. Approved videos show inline `<video>` on the public player profile
5. Player sees their own pending/rejected videos with status badge

Migration: `supabase/player-videos-migration.sql`

---

## URL Structure

```
/                              Homepage
/login                         Sign in / up / reset password
/account                       User profile (name, club, ranking, photo, password)
/account/reset-password        Password reset landing (from email link)

/t/[slug]                      Tournament landing page
/t/[slug]/courts               Live court board
/t/[slug]/players              Player lookup
/t/[slug]/announcements        Announcements feed
/t/[slug]/volunteer            Volunteer signup (public)
/t/[slug]/player/[id]          Player profile (matches + video highlights)
/t/[slug]/match/[id]           Match detail
/t/[slug]/match/[id]/score     Scoring app (4-step)

/t/[slug]/admin                Tournament admin dashboard
/t/[slug]/admin/matches        Match management (list + schedule views)
/t/[slug]/admin/courts         Court management + auto-assign
/t/[slug]/admin/players        Player management + CSV import
/t/[slug]/admin/draws          Draw generation + scheduling
/t/[slug]/admin/announcements  Announcements + push
/t/[slug]/admin/volunteers     Volunteer/referee management
/t/[slug]/admin/videos         Player video approval queue
/t/[slug]/admin/email          Tournament email marketing
/t/[slug]/admin/settings       Tournament appearance + details

/admin                         Top-level admin dashboard
/admin/tournaments             Create/manage tournaments
/admin/content                 Homepage hero + tournament graphics
/admin/email                   Global email marketing
/admin/settings                Integrations + env var reference
/admin/users                   User management (superadmin)
```

---

## Working Preferences

- Brief and direct — no fluff, no cheerleading
- Ask clarifying questions before diving in on ambiguous tasks
- TypeScript check: `npx tsc --noEmit` (ignore `.next/types/` errors)
- Commit after logical units of work; push to `main`
- For conditional Tailwind classes that might get purged, use inline styles
- Always use CSS var tokens (`--surface`, `--border`, etc.) — never hardcode `bg-white` or `text-zinc-700`
- Convert empty strings to `null` before PATCH requests to Supabase
- `force-dynamic` on any server component reading frequently-changing data

---

## Completed Features

- [x] Tournament landing pages with hero, countdown, schedule, announcements
- [x] Live court board (Supabase Realtime)
- [x] Player lookup + profile pages with match history
- [x] Match detail pages
- [x] Full scoring app (4-step: confirm → serve → warmup → scoring)
- [x] Auto game/match detection (PAR 11, win by 2, best of 5)
- [x] Volunteer/referee public signup
- [x] Admin: match management (list + schedule views, inline time edit, quick court move)
- [x] Admin: court management + auto-assign
- [x] Admin: draw generation + bracket scheduling
- [x] Admin: announcements + push notifications
- [x] Admin: player video approval queue
- [x] Email marketing (per-tournament + global)
- [x] PWA (installable, push notifications)
- [x] Dark/light theme system (all pages)
- [x] Navigation loading bar
- [x] Pull-to-refresh on mobile
- [x] Password reset flow (email → `/auth/callback?next=/account/reset-password` → reset form)
- [x] Change password from account profile
- [x] Player video uploads with admin approval

## Club Locker API (US Squash)

Club Locker has no public API and no bulk upload option, but the Angular app talks to a real REST API at `api.ussquash.com`. Discovered by inspecting network requests via the Chrome Performance API.

### Auth
- Token stored in browser localStorage: `localStorage.getItem('token_usq-clublocker')`
- Use as `Authorization: Bearer <token>` header
- Token expires — **must be grabbed from a live browser session**; stale tokens return empty match results (`{numberOfWeeksBackAllowed: 0, matches: []}`)
- No known programmatic refresh mechanism — scraping must be done in-browser or with a freshly grabbed token

### API Base
```
https://api.ussquash.com/resources/
```

### Key Endpoints

| Purpose | Endpoint |
|---------|----------|
| Rankings (paginated) | `GET /rankings/{groupId}/current?divisions={divId}&pageNumber={n}` |
| Player match history | `GET /res/user/{playerId}/matches_profile/page/{n}?pageSize=50` |
| Player profile | `GET /res/user/{playerId}` |

### SSRA-Specific IDs
- **Org ID:** 18
- **Rankings group ID:** 165 (International Singles)
- **Division IDs:** 1 = All Women, 2 = All Men
- Rankings return 50 players/page; iterate until empty page

### Match History Fields
`playerId, playerName, playerRating, division, date, result, opponentName, opponentId, score, matchType, eventName, ratingChange, newRating`

### Scraped Data (2025-04-30)
- **`~/Desktop/ssra_data/players.csv`** — 297 SSRA players (84 Women, 213 Men). Fields: `playerId, firstName, lastName, division, rating, ranking, city, state, homeClub, email, dob, age`
- **`~/Downloads/ssra_matches.csv`** — 28,809 match records for all 297 players

### In-Browser Scraper Approach
Because tokens expire, run scraping as JavaScript injected into a logged-in Club Locker tab (via Chrome DevTools or Claude's browser JS tool). Download results via Blob URL:
```javascript
const csv = '...';
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
a.download = 'filename.csv';
a.click();
```
The Chrome extension blocks JS return values containing sensitive data but does **not** block Blob downloads.

### Data Update Strategy
- **Targeted sync at import time:** When importing a CSV of tournament players, look up each player's current Club Locker rating/ranking and attach it. Covers out-of-region players without needing a full sync.
- **Periodic SSRA member refresh (future):** ~297 players, ~5 min. Needs token refresh mechanism or service-account login.
- **Not worth a full real-time sync** — Club Locker owns ratings; this app should read and display them, not try to replicate them.

---

## Pending / Wishlist

- [ ] Resend domain verification (seattlesquash.com) so emails reach any recipient
- [ ] ClubLocker CSV player import (with optional live rating lookup at import time)
- [ ] CSV export for players/results
- [ ] Bracket visualization
- [ ] Custom Vercel domain (seattlesquash.com)
- [ ] Referee auto-assign algorithm (assign refs to matches by round priority)
- [ ] Drag-to-reorder match scheduling
- [ ] "Sync from Club Locker" button on player import — for each player with a Club Locker ID, fetch current rating/ranking from `api.ussquash.com` and populate fields
- [ ] Post-tournament survey — auto-send a feedback survey to all registered players after a tournament ends (trigger: status → completed). Questions: overall experience, venue rating, court quality, organisation, NPS score, open comments. Results visible to organiser in tournament admin dashboard. Could use site_settings for default question set and allow per-tournament customisation.
