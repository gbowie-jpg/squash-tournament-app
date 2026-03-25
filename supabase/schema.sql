-- Seattle Squash Tournament Companion — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Tournaments
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  venue text,
  address text,
  start_date date not null,
  end_date date,
  status text default 'upcoming'
    check (status in ('upcoming', 'active', 'completed')),
  court_count int default 4,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courts
create table courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  status text default 'available'
    check (status in ('available', 'in_use', 'maintenance')),
  created_at timestamptz default now()
);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  seed int,
  club text,
  email text,
  phone text,
  draw text,
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  court_id uuid references courts(id),
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  draw text,
  round text,
  match_number int,
  status text default 'scheduled'
    check (status in ('scheduled', 'on_deck', 'in_progress', 'completed', 'walkover', 'cancelled')),
  scheduled_time timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  scores jsonb default '[]'::jsonb,
  winner_id uuid references players(id),
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Announcements
create table announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  message text not null,
  priority text default 'normal'
    check (priority in ('normal', 'urgent')),
  created_by uuid,
  created_at timestamptz default now()
);

-- Organizers (links Supabase Auth users to tournaments)
create table organizers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'admin'
    check (role in ('admin', 'scorer')),
  created_at timestamptz default now(),
  unique(tournament_id, user_id)
);

-- Indexes
create index idx_matches_tournament on matches(tournament_id);
create index idx_matches_status on matches(tournament_id, status);
create index idx_matches_court on matches(court_id);
create index idx_matches_player1 on matches(player1_id);
create index idx_matches_player2 on matches(player2_id);
create index idx_players_tournament on players(tournament_id);
create index idx_courts_tournament on courts(tournament_id);
create index idx_announcements_tournament on announcements(tournament_id, created_at desc);

-- Row Level Security
alter table tournaments enable row level security;
alter table courts enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table announcements enable row level security;
alter table organizers enable row level security;

-- Public read on all tables
create policy "Public read tournaments" on tournaments for select using (true);
create policy "Public read courts" on courts for select using (true);
create policy "Public read players" on players for select using (true);
create policy "Public read matches" on matches for select using (true);
create policy "Public read announcements" on announcements for select using (true);

-- Organizers can read their own records
create policy "Organizers read own" on organizers for select using (
  auth.uid() = user_id
);

-- Write policies: only authenticated organizers
create policy "Organizers manage tournaments" on tournaments for all using (
  exists (
    select 1 from organizers
    where organizers.tournament_id = tournaments.id
    and organizers.user_id = auth.uid()
  )
);

create policy "Organizers manage courts" on courts for all using (
  exists (
    select 1 from organizers
    where organizers.tournament_id = courts.tournament_id
    and organizers.user_id = auth.uid()
  )
);

create policy "Organizers manage players" on players for all using (
  exists (
    select 1 from organizers
    where organizers.tournament_id = players.tournament_id
    and organizers.user_id = auth.uid()
  )
);

create policy "Organizers manage matches" on matches for all using (
  exists (
    select 1 from organizers
    where organizers.tournament_id = matches.tournament_id
    and organizers.user_id = auth.uid()
  )
);

create policy "Organizers manage announcements" on announcements for all using (
  exists (
    select 1 from organizers
    where organizers.tournament_id = announcements.tournament_id
    and organizers.user_id = auth.uid()
  )
);

-- Enable Realtime on key tables
-- NOTE: Also enable via Supabase Dashboard → Database → Replication → toggle on matches, courts, announcements
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table courts;
alter publication supabase_realtime add table announcements;
