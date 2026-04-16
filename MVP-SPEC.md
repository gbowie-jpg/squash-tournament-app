# MVP Feature Spec — Seattle Squash Tournament Companion

> **Note:** This is the original spec written before development began (early 2026). Most features are now built. See `CLAUDE.md` → Completed Features for current status.

---

## Target: Usable at next SSRA tournament

---

## Pages & Routes

### Public Pages (no auth required)

#### 1. Home — `/` ✅
- List of tournaments (upcoming + active)
- Tap to enter a tournament

#### 2. Tournament Hub — `/t/[slug]` ✅
- Tournament name, venue, dates
- Quick links: Court Board, Find My Matches, Announcements
- At-a-glance: "X matches in progress, Y coming up"

#### 3. Court Board — `/t/[slug]/courts` ✅
**The big screen + phone view.** This is the app's centerpiece.
- Grid/list of all courts
- Each court shows: current match (players, draw, round, score), next match queued
- Color-coded status: green = in use, grey = available
- **Auto-updates via Supabase Realtime** — no refresh needed
- Tap a court for match details

#### 4. My Matches — `/t/[slug]/player/[player-id]` ✅
- Player's full schedule: past results + upcoming matches
- Current status prominently displayed
- Highlight video upload (player's own profile, requires login)

#### 5. Player Lookup — `/t/[slug]/players` ✅
- Search/filter player list by name
- Tap a player to see their schedule
- Draw sheet — group by draw, show seedings

#### 6. Announcements — `/t/[slug]/announcements` ✅
- Reverse-chronological feed
- Urgent announcements highlighted

#### 7. Volunteer Signup — `/t/[slug]/volunteer` ✅
- Public form: name, email, phone, role (referee/volunteer/helper), notes
- No login required

### Admin Pages (auth required — Supabase Auth)

#### 8. Admin Dashboard — `/t/[slug]/admin` ✅
- Overview: match status counts, court utilization
- Quick links to all sub-sections

#### 9. Match Management — `/t/[slug]/admin/matches` ✅
- List view: all matches, filter by draw/round/status
- Schedule view: per-court column layout with inline time editing
- Assign match to court, update status, enter scores
- Quick court move buttons
- Every change broadcasts via Realtime

#### 10. Court Management — `/t/[slug]/admin/courts` ✅
- Add/edit/reorder courts
- Set court status (available/maintenance)
- Auto-assign matches to courts

#### 11. Player Management — `/t/[slug]/admin/players` ✅
- Add players (manual entry)
- CSV import
- Set draw, seed, club

#### 12. Draw Generation — `/t/[slug]/admin/draws` ✅
- Generate brackets per draw division
- Auto-schedule matches

#### 13. Announcement Composer — `/t/[slug]/admin/announcements` ✅
- Write message, set priority (normal/urgent)
- Optional push notification to all subscribed browsers

#### 14. Volunteer & Referee Management — `/t/[slug]/admin/volunteers` ✅
- See all signups grouped by role
- Auto-assign referees to matches by round priority
- Manual referee assignment per match

#### 15. Player Video Approvals — `/t/[slug]/admin/videos` ✅
- Preview, approve, or reject player highlight videos
- Reject with optional reason shown to player

#### 16. Tournament Setup — `/admin/tournaments` ✅
- Create/edit tournaments
- Set venue, dates, court count, status

---

## Scoring App — `/t/[slug]/match/[id]/score` ✅

> Originally listed as "score-by-score live updates from referees" in the "NOT in MVP" section. Now built.

4-step flow: Confirm → Serve selection → Warmup (5-min timer) → Live point-by-point scoring

Rules:
- PAR scoring: every rally scores a point
- Games to 11, win by 2 (play to 12 at 10-all)
- Best of 5 (first to win 3 games)
- 90-second break between games (WSF Rule 14.1)

---

## Key UX Behaviors

### Real-Time Updates ✅
- Supabase Realtime subscriptions on `matches`, `courts`, `announcements`
- All public pages auto-update without refresh

### "On Deck" Logic ✅
When a match moves to `in_progress` on a court, the next `scheduled` match on that court automatically becomes `on_deck`.

### Player Notifications ✅
- PWA push notifications via VAPID — "Your match is on deck"
- Sent from Announcements composer

### Mobile-First Design ✅
- Court Board and My Matches are the primary mobile views
- Admin pages work on tablet/desktop

### PWA ✅
- Installable on iOS and Android
- Service worker caches the app shell

---

## What Was NOT in MVP (Original List)

| Feature | Status |
|---------|--------|
| Player authentication | Not built — players use direct links or search |
| Club Locker integration | Pending |
| Bracket visualization | Pending |
| Push notifications | ✅ Built (v1.1) |
| Score-by-score live updates from referees | ✅ Built (scoring app) |
| Spectator favorites / following | Not planned |
| Payment / registration | Not planned |
| Multiple tournament format engines | Partial — draws + round robin |

---

## Design Notes
- Clean, high-contrast design — readable in a bright squash club
- Large touch targets — people are tapping between matches with sweaty hands
- Dark mode available on all pages ✅
- Minimal chrome — the data IS the UI
