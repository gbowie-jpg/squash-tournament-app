# MVP Feature Spec — Seattle Squash Tournament Companion

## Target: Usable at next SSRA tournament (weeks away)

---

## Pages & Routes

### Public Pages (no auth required)

#### 1. Home — `/`
- List of tournaments (upcoming + active)
- Tap to enter a tournament

#### 2. Tournament Hub — `/t/[slug]`
- Tournament name, venue, dates
- Quick links: Court Board, Find My Matches, Announcements
- At-a-glance: "X matches in progress, Y coming up"

#### 3. Court Board — `/t/[slug]/courts`
**The big screen + phone view.** This is the app's centerpiece.
- Grid/list of all courts
- Each court shows: current match (players, draw, round, score if being updated), next match queued
- Color-coded status: green = available, yellow = in progress, grey = maintenance
- **Auto-updates via Supabase Realtime** — no refresh needed
- Tap a court for match details
- Designed to work on a lobby TV (full-screen mode) AND a phone

#### 4. My Matches — `/t/[slug]/player/[player-id]`
- Player's full schedule: past results + upcoming matches
- Current status prominently displayed:
  - "You're on Court 3 NOW" (if in_progress)
  - "You're ON DECK — Court 2, after current match" (if on_deck)
  - "Next match: ~2:30 PM, Court TBD vs. Alex Chen" (if scheduled)
- Link to get here: organizer generates per-player URLs, or player searches by name

#### 5. Player Lookup — `/t/[slug]/players`
- Search/filter player list by name
- Tap a player to see their schedule (goes to My Matches view)
- Also serves as a draw sheet — group by draw, show seedings

#### 6. Announcements — `/t/[slug]/announcements`
- Reverse-chronological feed
- Urgent announcements highlighted
- Also shown as a banner/ticker on Court Board and My Matches views

### Admin Pages (auth required — Supabase Auth)

#### 7. Admin Dashboard — `/t/[slug]/admin`
- Overview: match status counts, court utilization
- Quick actions: push announcement, start next round

#### 8. Match Management — `/t/[slug]/admin/matches`
- List all matches, filter by draw/round/status
- Assign match to court (dropdown or drag)
- Update status: scheduled → on_deck → in_progress → completed
- Enter scores (game-by-game: e.g., 11-7, 9-11, 11-5, 11-8)
- Set winner
- Every change broadcasts via Realtime instantly

#### 9. Court Management — `/t/[slug]/admin/courts`
- Add/edit/reorder courts
- Set court status (available/maintenance)
- View court schedule for the day

#### 10. Player Management — `/t/[slug]/admin/players`
- Add players (manual entry for MVP)
- Set draw, seed, club
- Generate shareable "My Matches" links
- Future: CSV import, Club Locker sync

#### 11. Announcement Composer — `/t/[slug]/admin/announcements`
- Write message, set priority (normal/urgent)
- Publish → instant push to all connected clients

#### 12. Tournament Setup — `/admin/tournaments`
- Create/edit tournaments
- Set venue, dates, court count
- Manage organizer access

---

## Key UX Behaviors

### Real-Time Updates
- Supabase Realtime subscriptions on `matches`, `courts`, `announcements`
- All public pages auto-update without refresh
- Visual indicator when data updates (subtle flash/highlight on changed items)
- Connection status indicator (green dot = live, red = reconnecting)

### "On Deck" Logic
When an organizer marks a match `in_progress` on a court, the next scheduled match for that court automatically becomes `on_deck`. Both affected players see their status change instantly.

### Player Notifications (MVP-lite)
- No push notifications in v1 (requires service worker + VAPID setup)
- Instead: prominent visual status on My Matches page + court board
- **v1.1**: PWA push notifications — "Your match is on deck, Court 3"

### Mobile-First Design
- Court Board and My Matches are the primary mobile views
- Admin pages can be tablet/desktop-optimized (organizer is usually at a table)
- Court Board has a "TV mode" (full-screen, large text, auto-rotate through courts)

### Offline Resilience
- PWA caches the app shell
- Show "last updated X seconds ago" when connection drops
- Queue organizer actions if briefly offline, sync when reconnected (stretch goal)

---

## What's NOT in MVP
- Player authentication (players don't log in — they use direct links or search)
- Club Locker integration / data sync
- Bracket visualization (just list matches by round for now)
- Push notifications (v1.1)
- Score-by-score live updates from referees
- Spectator favorites / following
- Multiple tournament format engines (just flat match lists grouped by draw/round)
- Payment / registration

---

## Implementation Order (Suggested)

1. **Supabase setup** — create project, run schema SQL, enable Realtime, set up RLS
2. **Tournament + Court + Player admin** — CRUD pages so organizer can set up an event
3. **Match admin** — create matches, assign to courts, update status/scores
4. **Court Board** (public) — the showcase page, real-time court grid
5. **My Matches** (public) — player schedule view with status
6. **Player Lookup** (public) — search + draw sheet
7. **Announcements** — composer (admin) + feed (public) + banner on other pages
8. **PWA setup** — manifest, service worker, add-to-home-screen
9. **Polish** — TV mode for court board, mobile refinements, connection status indicator

---

## Design Notes
- Clean, high-contrast design — readable in a bright squash club
- Large touch targets — people are tapping between matches with sweaty hands
- Court status colors should be colorblind-safe
- Minimal chrome — the data IS the UI
- Consider dark mode for TV/projector display
