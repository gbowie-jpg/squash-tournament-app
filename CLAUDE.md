# Seattle Squash Tournament App — Claude Code Context

## What This Is

Real-time tournament companion app for **SSRA (Seattle Squash Racquets Association)**.
Deployed at **squash-tournament-app.vercel.app** (Vercel, auto-deploys on push to `main`).
Supabase project ref: **rhrkkwvrehntnqqadehq**

**App, not website.** seattlesquash.com (WordPress) is the public website — news, about, donations, newsletters. Don't add website/marketing pages here; build things that need an app (push, live data, knowing who the player is). Removed 2026-10-21: /about, /contact, /donate, /galleries, /events, homepage hero. Scholarship and global email marketing are still here pending a decision.

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
LEAGUE_SYNC_SECRET          # bearer token pg_cron sends to /api/league/sync (same value in supabase/league-cron.sql)
```

VAPID keys are set in `.env.local` and Vercel (Production, Preview, Development — all the same pair). Never commit key values — this repo is public. Rotation procedure: see **Push Notifications** below.

Auth redirect URLs configured in Supabase:
- `https://squash-tournament-app.vercel.app/**`
- `http://localhost:3000/**`

---

## Project Structure

```
src/
  app/
    page.tsx                          # App home — league hub (next league night, results, playoff race) + tournaments. No marketing content
    league/
      page.tsx                        # Winter League — this week, latest results, standings per division
      division/[id]/page.tsx          # Full standings + schedule (id = Club Locker division id)
      team/[id]/page.tsx              # Roster by rating (playing order) + fixtures (id = Club Locker team id)
      match/[id]/page.tsx             # Scorecard with rubbers, auto-refreshes on match day (id = Club Locker scorecard id)
    winter-league/page.tsx            # Redirects to /league
    layout.tsx                        # Root layout — ThemeProvider, NavigationLoadingBar, manifest
    not-found.tsx                     # Custom 404
    login/page.tsx                    # Sign in / magic link / Password reset (no public sign-up)
    join/[token]/page.tsx             # Invite-only account sign-up (token = site_settings.invite_token)
    auth/confirm/page.tsx             # Email confirmation page — button only, never consumes the token on GET
    auth/confirm/verify/route.ts      # POST: verifyOtp(token_hash) → 303 to /account/set-password (signup) or next
    auth/callback/route.ts            # PKCE code exchange landing
    account/
      page.tsx                        # User profile — name, club, ranking, photo, change password
      reset-password/page.tsx         # Password reset landing (handles Supabase recovery token)
      set-password/page.tsx           # New accounts choose their password (+ confirm name) after confirming email
    admin/
      page.tsx                        # Top-level admin dashboard
      tournaments/page.tsx            # Create/manage tournaments (dark theme)
      content/page.tsx                # Tournament graphics (links to each tournament's image settings)
      email/page.tsx                  # Global email marketing (tag-based)
      settings/page.tsx               # Integrations, env vars, URL reference
      users/page.tsx                  # User management (superadmin)
    t/[slug]/
      page.tsx                        # Public tournament landing page
      courts/page.tsx                 # Live court board (real-time)
      players/page.tsx                # Player lookup / draw sheet
      announcements/page.tsx          # Public announcements feed
      volunteer/page.tsx              # Public volunteer signup (records signup only — no account)
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
    tournaments/[id]/players/route.ts  # organizer-only (full rows incl. contact/payment)
    tournaments/[id]/players/[playerId]/route.ts  # public player page data: public columns + profile + isOwn
    tournaments/[id]/matches/route.ts # includes winner progression + on_deck logic
    tournaments/[id]/courts/route.ts
    tournaments/[id]/announcements/route.ts
    tournaments/[id]/volunteers/route.ts
    tournaments/[id]/videos/route.ts  # GET/POST/PATCH/DELETE player videos
    tournaments/[id]/email/route.ts
    tournaments/[id]/referees/assign/route.ts
    league/sync/route.ts              # POST: Club Locker league sync (pg_cron bearer secret or admin session)
    site-settings/route.ts            # GET public allowlisted keys / PATCH (admin) — key lists in src/lib/site-settings.ts
    join/route.ts                     # Invite-only sign-up (GET token check, POST create + confirmation email)
    auth/me/route.ts
    account/profile/route.ts
    account/photo/route.ts
    push/subscribe/route.ts
    push/send/route.ts
    push/status/route.ts              # GET (admin): VAPID self-check ok/reason + public-key fingerprint, never key values
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
    league/                           # LeagueHub (homepage block), LeagueParts (FixtureCard, StandingsTable…), LeagueShell, AutoRefresh
  lib/
    supabase/
      client.ts                       # Browser Supabase client
      server.ts                       # Server Supabase client
      admin.ts                        # Admin client (service role)
      types.ts                        # DB types — keep in sync with schema
      auth-check.ts                   # requireAuth() helper
    league/                           # clublocker.ts (fetch + parse), sync.ts, standings.ts, db.ts (public read client), types.ts, time.ts, view.ts
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
| `players` | Participants (no auth required). anon/authenticated may SELECT only `PUBLIC_PLAYER_COLUMNS` (`src/lib/supabase/types.ts`); email/phone/payment fields are service-role only — never `select('*')` / `players(*)` from the browser or RLS-bound clients |
| `matches` | Core — status, scores, court, referee |
| `announcements` | Organizer messages |
| `volunteers` | Signup data — role: referee/volunteer/helper. Service-role only (no anon/authenticated access) |
| `player_videos` | Player highlight clips — pending/approved/rejected |
| `email_recipients` | Per-tournament marketing list |
| `email_campaigns` | Sent campaigns |
| `email_sends` | Per-recipient send records |
| `push_subscriptions` | VAPID push endpoint data, tagged with `vapid_public_key` (the key the browser subscribed with). Service-role only (no RLS policies) |
| `site_settings` | Key/value — scholarship/email template content, Stripe keys, `invite_token`. Server-only (no RLS policies); new keys must be added to `src/lib/site-settings.ts` |
| `profiles` | Extended user data — name, club, ranking, photo, role |
| `organizers` | Per-tournament admin/scorer access |
| `league_seasons` / `league_divisions` / `league_teams` / `league_roster` / `league_fixtures` / `league_rubbers` | Read-only mirror of the Club Locker Winter League (`supabase/league-migration.sql`). Public SELECT, written only by the sync (service role). `league_divisions.rating_band` is hand-set; sync never overwrites it |

---

## Auth & Roles

**Roles** (stored in `profiles.role`):
- `user` — default
- `admin` — can manage tournaments
- `superadmin` — can also manage users

**Auth flows:**
- Email/password sign in (or magic link — `shouldCreateUser: false`)
- **Sign-up is invite-only.** Public sign-up is disabled in Supabase Auth and `/login` has no sign-up mode. The only way to create an account is the shared invite link `/join/[token]` (token in `site_settings.invite_token`; admins copy/regenerate it in `/admin/users`). `/join` takes **first name, last name, email only — no password**. `POST /api/join` validates the token, creates an **unconfirmed** user via `auth.admin.generateLink({ type: 'signup' })` with a random throwaway password nobody knows, and emails a confirmation link (via Resend) to `/auth/confirm?token_hash=…&type=signup`. That page **does not consume the token on GET** (email link scanners like Defender Safe Links prefetch links); it shows a "Confirm my account" button that form-POSTs to `/auth/confirm/verify`, which calls `verifyOtp` (cookie-aware server client, same-origin check), **replaces the account's password with a random one** (user-facing `PUT /auth/v1/user` with the new session — not the admin API, which would log that session out), and 303s to `/account/set-password`, where the person picks their password (`supabase.auth.updateUser`) and confirms their name. The confirm button ignores double submits, and a failed verify for an account confirmed in the last 10 minutes in the same browser continues to set-password. Existing **unconfirmed** emails: `/api/join` first resets the pending account's password to a random value (admin `updateUserById`, before `generateLink`, because an admin password change clears the confirmation token), then calls `generateLink` **without** `options.data` — GoTrue merges `options.data` into an existing unconfirmed user's metadata, so skipping it keeps the stored name. The call still issues a new confirmation token, which invalidates any earlier confirmation link (expected for a resend; capped at 3 per address per hour, plus 30 submits per IP per hour). No name is used in the email for an existing account. Existing **confirmed** emails get a "you already have an account" email. Same response in every case (no account enumeration). An invite-token lookup failure returns 503 (page shows a retry state), not "invalid link".
- **Invite token rotation after deploys that change token exposure:** (1) push and wait for the Vercel deploy to be live; (2) check `curl -s https://squash-tournament-app.vercel.app/api/site-settings | grep -c invite_token` prints 0; (3) turn OFF "Allow new users to sign up" in Supabase Auth; (4) an admin presses Regenerate in `/admin/users` (or run `update site_settings set value = gen_random_uuid()::text, updated_at = now() where key = 'invite_token';`) and shares only the new link; (5) review `auth.users` created since the token was exposed and delete/demote unknown accounts, and delete (or reset to a random password) every pre-existing unconfirmed user. Never rotate before step 1 — the old `GET /api/site-settings` would leak the new token.
- Auth landing routes (`/auth/callback`, `/auth/confirm/verify`) only redirect to `/login?error=<code>` (`invalid_link`, `link_expired`, `confirm_failed`); `/login` maps known codes to fixed copy in `src/lib/auth-errors.ts` and ignores anything else.
- Volunteer/referee signup (`/t/[slug]/volunteer`) only records the signup — it never creates an account. Referees who need to score get the invite link.
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

## Push Notifications

- **Key tagging:** each `push_subscriptions` row stores `vapid_public_key`, the public key the browser subscribed with (`PushManager` / `sw.js` send it as `applicationServerKey`; missing/invalid → NULL). `sendPushToAll()` (`src/lib/push.ts`) sends **only** to rows whose key equals the configured `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (trimmed). NULL/other-key rows are skipped (reported as `skipped`), never deleted by the sender — so a Preview/dev/rollback build with a different keypair can't wipe production rows (they all share the production DB).
- **Self-check:** on first send, `checkVapidKeypair()` (`src/lib/vapid.ts`) derives the public key from `VAPID_PRIVATE_KEY` (P-256 ECDH) and compares bytes with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Missing/malformed/mismatched → logs `[push] VAPID self-check failed` (fingerprint only), sends nothing, prunes nothing; `/api/push/send` returns 503. VAPID setup is lazy, so a bad key never breaks routes that import `push.ts` (e.g. matches).
- **Pruning** (`planPrunes()` in `src/lib/push-prune.ts`, for rows actually sent to): 404/410 → delete; 401/403 → delete only if the self-check passed **and** another send to the same push service in that batch succeeded (circuit breaker against our own credential problems); anything else → keep.
- **Endpoint allowlist:** `POST /api/push/subscribe` only accepts https endpoints on FCM, Mozilla autopush, Apple (`*.push.apple.com`) and WNS (`*.notify.windows.com`) — `isAllowedPushEndpoint()`. Others → 400 (prevents SSRF).
- **Client migration:** on load (once per page load, shared across mounted bells) `PushManager` compares the browser subscription's `applicationServerKey` with the build's key. Same → re-POSTs once per endpoint+key (localStorage marker) so legacy NULL rows get tagged. Different → DELETE old row, `unsubscribe()`, re-subscribe with the new key, POST. Granted but no subscription → auto-subscribes only if the user previously opted in (`push:optedIn`).
- `sw.js` `notificationclick` only opens same-origin URLs (else `/`); `pushsubscriptionchange` re-subscribes with the old subscription's key and POSTs it (tagged accurately; the page migrates it if stale).

**VAPID rotation:**
1. `npx web-push generate-vapid-keys --json` (keep the output out of the repo and chat).
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in Vercel for **Production, Preview and Development** (private key marked Sensitive) and in `.env.local`.
3. Deploy via a new build (push to `main`). The public key is inlined at build time, so editing env vars alone does nothing; don't "Redeploy" an old commit that lacks the migration code.
4. Check Vercel logs for `[push] VAPID self-check failed` (must be absent). Subscribers move to the new key on their next visit; until then they're `skipped`. Rotate a few days before a tournament.
5. After a few weeks: `delete from push_subscriptions where vapid_public_key is distinct from '<new public key>';` (the public key isn't secret, but don't commit it). Never Instant-Rollback to a deployment built with the old keys.

## Winter League (Club Locker mirror)

Club Locker is the system of record for the league: captains enter scores there (US Squash sanctioned, ratings, late-entry penalties). This app **never collects league scores** — it mirrors Club Locker's public league API and presents it.

- **Sync** (`src/lib/league/sync.ts`): pg_cron (`supabase/league-cron.sql`) POSTs `/api/league/sync?mode=auto` every 5 min with `Authorization: Bearer $LEAGUE_SYNC_SECRET`. `decideSyncMode()`: full sync hourly (divisions, standings, schedule, rosters, recent/missing rubbers); live sync every ~5 min on days with fixtures after 5:30 PM Pacific (standings, schedule, today's rubbers); otherwise no-op. Admins can force one: `POST /api/league/sync?mode=full` with a session cookie.
- Failed Club Locker requests keep the last rows and are recorded in `league_seasons.last_sync_error` (not readable by anon). Pages show "Updated from Club Locker X ago".
- **Privacy:** Club Locker responses include captain emails/phones and roster payment fields (`AmountPaid`, `Owes`). The `parse*` functions in `clublocker.ts` keep only public fields — never widen them to pass those through.
- **Standings** (`standings.ts`): points from Club Locker's `TotalPointsTeamwins` (includes penalties); W–L/rubbers/games/points computed from fixtures; 2–2 matches won on games then rally points; ties on points broken by team W–L, rubber, game, then point differential (league rules). Verified to match Club Locker on 2026-10-20 results.
- **New season:** insert a `league_seasons` row with the Club Locker season id (from `clublocker.com/leagues/<id>/home`) and `is_current = true`, set the old one false. Set `rating_band` on the divisions by hand after the first sync.
- Dates/times are Pacific; Club Locker live-scoring timestamps have no offset and are converted in `pacificLocalToIso()`.

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
/login                         Sign in / magic link / reset password
/join/[token]                  Invite-only account sign-up
/auth/confirm                  Email confirmation page (button → POST /auth/confirm/verify → session)
/auth/callback                 PKCE code exchange landing
/account                       User profile (name, club, ranking, photo, password)
/account/reset-password        Password reset landing (from email link)
/account/set-password          New account: choose password after confirming email

/league                        Winter League (this week, results, standings)
/league/division/[clId]        Division standings + schedule
/league/team/[clId]            Team roster + fixtures
/league/match/[clId]           League scorecard (rubbers, live on match day)

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
/admin/content                 Tournament graphics
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
- [x] Volunteer/referee public signup (no account created)
- [x] Invite-only account sign-up (`/join/[token]` name + email → scanner-safe confirm page `/auth/confirm` → `/account/set-password`)
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
- [x] Winter League mirror from Club Locker (`/league`: fixtures, live rubbers, results, standings, rosters) + league hub on the homepage

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
| League season → divisions (public) | `GET /leagues/info/{seasonId}` |
| Division standings (public) | `GET /divisions/standings/{divisionId}` |
| Division schedule + results (public) | `GET /divisions/schedule/{divisionId}/` — "Sets" = games, "Games" = rally points |
| Team roster (public) | `GET /teams/{teamId}/players` |
| Scorecard rubbers, home-oriented, with names (public) | `GET /leagues/scorecards/live?id={scorecardId}` |

League endpoints need no token. SSRA Winter League 2026–27 = season **2625** (divisions 6537/6538/6539).

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

- [x] Resend domain verification (seattlesquash.com) so emails reach any recipient
- [ ] ClubLocker CSV player import (with optional live rating lookup at import time)
- [ ] CSV export for players/results
- [ ] Bracket visualization
- [ ] Custom Vercel domain (seattlesquash.com)
- [ ] Referee auto-assign algorithm (assign refs to matches by round priority)
- [ ] Drag-to-reorder match scheduling
- [ ] "Sync from Club Locker" button on player import — for each player with a Club Locker ID, fetch current rating/ranking from `api.ussquash.com` and populate fields
- [ ] Post-tournament survey — auto-send a feedback survey to all registered players after a tournament ends (trigger: status → completed). Questions: overall experience, venue rating, court quality, organisation, NPS score, open comments. Results visible to organiser in tournament admin dashboard. Could use site_settings for default question set and allow per-tournament customisation.
