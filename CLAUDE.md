# Seattle Squash Tournament Companion App

## What This Is

Real-time tournament-day companion app for **SSRA (Seattle Squash)**. Players know when and where their matches are. Organizers push live updates from a control panel. Spectators see what's happening on every court.

**This is NOT a Club Locker replacement.** Club Locker handles registration, draws, and seeding (required by US Squash for sanctioned events). This fills the gap Club Locker ignores: live communication during the tournament day.

**Strategy:** Companion app now, absorb Club Locker functions over time.

## Owner

Personal project — Geof Bowie. Not FASTSIGNS work.

---

## Working Method

- Scaffold with `npx create-next-app@latest . --typescript --tailwind --app --src-dir`
- Deploy to **Vercel** (natural fit for Next.js App Router)
- **Supabase** for DB, auth, and Realtime — create project at supabase.com, run schema SQL from `DATA-MODEL.md`, enable Realtime on `matches`, `courts`, `announcements`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Git-based deploy: push to main → Vercel auto-deploys

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (organizers only — players have no accounts) |
| Real-time | Supabase Realtime subscriptions |
| Deployment | Vercel |
| PWA | next-pwa (v1.1) |

---

## Project Structure

```
src/
  app/
    page.tsx                          # Home — tournament list
    t/
      [slug]/
        page.tsx                      # Tournament Hub
        courts/
          page.tsx                    # Court Board (public, real-time)
        player/
          [playerId]/
            page.tsx                  # My Matches (public)
        players/
          page.tsx                    # Player Lookup + draw sheet
        announcements/
          page.tsx                    # Announcements feed
        admin/
          page.tsx                    # Admin Dashboard
          matches/
            page.tsx                  # Match Management
          courts/
            page.tsx                  # Court Management
          players/
            page.tsx                  # Player Management
          announcements/
            page.tsx                  # Announcement Composer
    admin/
      tournaments/
        page.tsx                      # Tournament Setup (super-admin)
  components/
    court-board/
    match-card/
    player-schedule/
    announcements/
    admin/
    ui/                               # Shared UI primitives
  lib/
    supabase/
      client.ts                       # Browser client (singleton)
      server.ts                       # Server client (cookies)
      types.ts                        # Generated or hand-written DB types
    realtime/
      hooks.ts                        # useRealtimeMatches, useRealtimeCourts, etc.
    utils.ts
  types/
    index.ts                          # App-level types
```

---

## Data Model Summary

Five core tables — full SQL in `DATA-MODEL.md`.

| Table | Purpose |
|-------|---------|
| `tournaments` | Top-level container. Has a URL `slug`. |
| `courts` | Physical courts per tournament. Status: available / in_use / maintenance |
| `players` | Participants. No auth. Grouped by `draw` ("Open", "B", etc.) |
| `matches` | Core table. Status flow: scheduled → on_deck → in_progress → completed |
| `announcements` | Organizer-pushed messages. Priority: normal / urgent |
| `organizers` | Links Supabase Auth users to tournaments they can manage |

**Realtime** enabled on: `matches`, `courts`, `announcements`

**RLS**: Public read on all tables. Write gated by `organizers` table membership.

---

## Match Status Flow

```
scheduled → on_deck → in_progress → completed
                                  ↘ walkover / cancelled
```

**On Deck logic:** When organizer marks a match `in_progress` on a court, the next `scheduled` match for that court auto-transitions to `on_deck`. Both players' My Matches pages update instantly.

---

## Key UX Rules

- **Mobile-first** — Court Board and My Matches are the primary phone views
- **High contrast, large touch targets** — sweaty hands, bright squash club lighting
- **Colorblind-safe** court status colors (avoid pure red/green — use amber/teal or add icons)
- **Minimal chrome** — the data IS the UI
- **Dark mode** variant for Court Board (TV / projector display)
- **TV mode** for Court Board: full-screen, large text, auto-rotate through courts
- Visual flash/highlight on items when Realtime updates arrive
- Connection status indicator (green dot = live, red = reconnecting)

---

## Realtime Pattern

Use Supabase Realtime in a custom hook. Example pattern:

```ts
// lib/realtime/hooks.ts
export function useRealtimeMatches(tournamentId: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    supabase
      .from('matches')
      .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts(*)')
      .eq('tournament_id', tournamentId)
      .then(({ data }) => setMatches(data ?? []))

    // Subscribe to changes
    const channel = supabase
      .channel(`matches:${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, (payload) => {
        // Merge change into local state
        setMatches(prev => mergeChange(prev, payload))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournamentId])

  return matches
}
```

Same pattern for `courts` and `announcements`.

---

## Admin Auth Pattern

Organizers log in via Supabase Auth (email/password or magic link). Protected routes check session server-side:

```ts
// In admin layout.tsx
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children, params }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Check organizer access for this tournament
  const { data: organizer } = await supabase
    .from('organizers')
    .select()
    .eq('tournament_id', params.tournamentId)  // resolved from slug
    .eq('user_id', session.user.id)
    .single()

  if (!organizer) redirect('/unauthorized')
  return <>{children}</>
}
```

---

## Implementation Order

Build in this sequence — each phase is usable on its own:

1. **Supabase setup** — create project, run schema SQL, enable Realtime, configure RLS
2. **Next.js scaffold** — `create-next-app`, install `@supabase/supabase-js`, `@supabase/ssr`, set up client/server helpers
3. **Tournament Setup admin** — `/admin/tournaments` CRUD (create tournament, set slug, venue, dates)
4. **Court + Player admin** — add courts, add players manually, assign draws/seeds
5. **Match admin** — create matches, assign courts, update status + scores
6. **Court Board** (public) — real-time court grid with current + next match per court
7. **My Matches** (public) — player schedule with prominent on_deck / in_progress status
8. **Player Lookup** (public) — search by name, grouped draw sheet
9. **Announcements** — admin composer + public feed + banner on Court Board / My Matches
10. **Polish** — TV mode, connection indicator, visual update flashes, mobile refinements
11. **PWA** — manifest, service worker, add-to-home-screen prompt (v1.1)

---

## What's NOT in MVP

- Player auth (players don't log in — direct links or name search only)
- Club Locker integration / CSV import
- Bracket visualization (flat match list grouped by draw/round is enough)
- Push notifications (v1.1 with PWA)
- Live score-by-score updates from referees
- Spectator favorites / following
- Payment / registration

---

## Scores Format

Stored as JSONB array in `matches.scores`:

```json
[
  { "p1": 11, "p2": 7 },
  { "p1": 9, "p2": 11 },
  { "p1": 11, "p2": 5 },
  { "p1": 11, "p2": 8 }
]
```

Winner determined by game count. UI renders as "11-7, 9-11, 11-5, 11-8".

---

## Communication Preferences

- Brief and direct — no fluff, no cheerleading
- Ask clarifying questions before diving in on anything ambiguous
- Wry humor is welcome at about a 3/10
