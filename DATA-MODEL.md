# Data Model — Supabase Schema

## Tables

### tournaments
The top-level container. One per event.

```sql
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,            -- URL-friendly: "ssra-spring-open-2026"
  venue text,
  address text,
  start_date date not null,
  end_date date,
  status text default 'upcoming'        -- upcoming | active | completed
    check (status in ('upcoming', 'active', 'completed')),
  court_count int default 4,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### courts
Physical courts at the venue. Tied to a tournament so numbering/naming can vary by event.

```sql
create table courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,                   -- "Court 1", "Show Court", etc.
  sort_order int default 0,
  status text default 'available'       -- available | in_use | maintenance
    check (status in ('available', 'in_use', 'maintenance')),
  created_at timestamptz default now()
);
```

### players
Participants in a tournament. For MVP, just name + optional contact. No auth required for players — they find themselves by name or get a direct link.

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  seed int,                             -- seeding number, nullable
  club text,                            -- home club
  email text,
  phone text,
  draw text,                            -- which draw they're in: "Open", "B", "C", "Women's"
  created_at timestamptz default now()
);
```

### matches
The core table. Every match in the tournament. Organizer assigns court + updates status. Supabase Realtime broadcasts changes.

```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  court_id uuid references courts(id),  -- null = not yet assigned
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  draw text,                            -- "Open", "B Draw", "Consolation", etc.
  round text,                           -- "R32", "R16", "QF", "SF", "F", "RR Pool A"
  match_number int,                     -- for ordering within a round
  status text default 'scheduled'
    check (status in ('scheduled', 'on_deck', 'in_progress', 'completed', 'walkover', 'cancelled')),
  scheduled_time timestamptz,           -- approximate start time
  started_at timestamptz,
  completed_at timestamptz,
  -- Scores: array of game scores, e.g. [{p1: 11, p2: 7}, {p1: 9, p2: 11}, ...]
  scores jsonb default '[]'::jsonb,
  winner_id uuid references players(id),
  notes text,                           -- "Player arrived late", etc.
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### announcements
Organizer pushes messages to everyone. Shows in a feed on all views.

```sql
create table announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  message text not null,
  priority text default 'normal'        -- normal | urgent
    check (priority in ('normal', 'urgent')),
  created_by uuid,                      -- organizer user id (Supabase Auth)
  created_at timestamptz default now()
);
```

### organizers
Links Supabase Auth users to tournaments they can manage. MVP: simple role check.

```sql
create table organizers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'admin'             -- admin | scorer (future: let volunteers update scores)
    check (role in ('admin', 'scorer')),
  created_at timestamptz default now(),
  unique(tournament_id, user_id)
);
```

## Key Indexes

```sql
create index idx_matches_tournament on matches(tournament_id);
create index idx_matches_status on matches(tournament_id, status);
create index idx_matches_court on matches(court_id);
create index idx_matches_player1 on matches(player1_id);
create index idx_matches_player2 on matches(player2_id);
create index idx_players_tournament on players(tournament_id);
create index idx_announcements_tournament on announcements(tournament_id, created_at desc);
```

## Realtime Subscriptions

Enable Realtime on these tables (Supabase Dashboard → Database → Replication):

- **matches** — core real-time updates (court assignments, status changes, scores)
- **announcements** — new announcements push to all clients
- **courts** — status changes (available/in_use)

## Row Level Security (RLS)

MVP policy: public read on everything, write restricted to authenticated organizers.

```sql
-- Public read for all tournament data
alter table tournaments enable row level security;
create policy "Public read" on tournaments for select using (true);

-- Same pattern for courts, players, matches, announcements
-- Write policies check organizers table:
create policy "Organizers can manage matches" on matches
  for all using (
    exists (
      select 1 from organizers
      where organizers.tournament_id = matches.tournament_id
      and organizers.user_id = auth.uid()
    )
  );
```

## Future Tables (Post-MVP)

- **tournament_formats** — define bracket structures, pool assignments, progression rules
- **notifications** — per-player push notification queue
- **spectator_favorites** — bookmark players/matches to follow
- **club_locker_sync** — mapping table for eventual Club Locker data import
