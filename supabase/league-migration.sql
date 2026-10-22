-- Winter League — read-only mirror of the Club Locker league.
--
-- Club Locker (US Squash) is the system of record: captains enter scores there
-- and ratings are calculated from them. These tables are filled only by the
-- sync job (src/lib/league/sync.ts, service role) from Club Locker's public
-- league API. Everything here is public league information, so anon and
-- authenticated may SELECT; nobody but the service role writes.
--
-- Never store captain emails/phones or roster payment fields (AmountPaid,
-- Owes) — the Club Locker responses include them but we drop them in sync.

create table if not exists league_seasons (
  id uuid primary key default gen_random_uuid(),
  cl_season_id integer not null unique,
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  last_full_sync_at timestamptz,
  last_live_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);

create table if not exists league_divisions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references league_seasons(id) on delete cascade,
  cl_division_id integer not null unique,
  name text not null,
  rating_band text,            -- e.g. '4.6 and above' — set by hand, sync never overwrites
  sort_order integer not null default 0
);

create table if not exists league_teams (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references league_divisions(id) on delete cascade,
  cl_team_id integer not null unique,
  name text not null,          -- Club Locker name without the ' - DT' club suffix
  club_code text,              -- DT, NG, PC, CAC, UW, WAC …
  logo_url text,
  cl_points integer not null default 0,  -- standings points as Club Locker calculates them (incl. penalties)
  updated_at timestamptz not null default now()
);

create table if not exists league_roster (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references league_teams(id) on delete cascade,
  cl_player_id integer not null,
  name text not null,
  rating numeric(5,3),
  is_captain boolean not null default false,
  wins integer not null default 0,
  losses integer not null default 0,
  unique (team_id, cl_player_id)
);

create table if not exists league_fixtures (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references league_divisions(id) on delete cascade,
  cl_scorecard_id integer not null unique,
  match_date date not null,
  start_time time,
  home_team_id uuid references league_teams(id) on delete set null,
  away_team_id uuid references league_teams(id) on delete set null,
  venue_name text,
  court text,
  round text,                  -- Club Locker round code; 'L' = regular season
  cl_status text not null default 'Scheduled',  -- Club Locker Score_Entered (Scheduled, Entered, Confirmed, …)
  home_rubbers integer not null default 0,
  away_rubbers integer not null default 0,
  home_games integer not null default 0,
  away_games integer not null default 0,
  home_points integer not null default 0,   -- rally points won
  away_points integer not null default 0,
  home_extra integer not null default 0,    -- bonus points (team win + full team/refs)
  away_extra integer not null default 0,
  home_deduct integer not null default 0,
  away_deduct integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists league_rubbers (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references league_fixtures(id) on delete cascade,
  position integer not null,
  home_player_name text,
  away_player_name text,
  home_cl_player_id integer,
  away_cl_player_id integer,
  games jsonb not null default '[]',   -- [[home, away], …], home-first
  winner text check (winner in ('home', 'away')),
  is_live boolean not null default false,
  is_complete boolean not null default false,
  court text,
  started_at timestamptz,
  ended_at timestamptz,
  unique (fixture_id, position)
);

create index if not exists idx_league_divisions_season on league_divisions(season_id);
create index if not exists idx_league_teams_division on league_teams(division_id);
create index if not exists idx_league_roster_team on league_roster(team_id);
create index if not exists idx_league_roster_player on league_roster(cl_player_id);
create index if not exists idx_league_fixtures_division_date on league_fixtures(division_id, match_date);
create index if not exists idx_league_fixtures_date on league_fixtures(match_date);
create index if not exists idx_league_fixtures_home on league_fixtures(home_team_id);
create index if not exists idx_league_fixtures_away on league_fixtures(away_team_id);
create index if not exists idx_league_rubbers_fixture on league_rubbers(fixture_id);

-- Public read, service-role write.
alter table league_seasons enable row level security;
alter table league_divisions enable row level security;
alter table league_teams enable row level security;
alter table league_roster enable row level security;
alter table league_fixtures enable row level security;
alter table league_rubbers enable row level security;

drop policy if exists "league_seasons public read" on league_seasons;
create policy "league_seasons public read" on league_seasons for select to anon, authenticated using (true);
drop policy if exists "league_divisions public read" on league_divisions;
create policy "league_divisions public read" on league_divisions for select to anon, authenticated using (true);
drop policy if exists "league_teams public read" on league_teams;
create policy "league_teams public read" on league_teams for select to anon, authenticated using (true);
drop policy if exists "league_roster public read" on league_roster;
create policy "league_roster public read" on league_roster for select to anon, authenticated using (true);
drop policy if exists "league_fixtures public read" on league_fixtures;
create policy "league_fixtures public read" on league_fixtures for select to anon, authenticated using (true);
drop policy if exists "league_rubbers public read" on league_rubbers;
create policy "league_rubbers public read" on league_rubbers for select to anon, authenticated using (true);

-- The sync error text is internal; hide it from the public API. A column-level
-- revoke does nothing while the table-level grant exists, so swap the
-- table grant for a column list.
revoke select on league_seasons from anon, authenticated;
grant select (id, cl_season_id, name, start_date, end_date, is_current, last_full_sync_at, last_live_sync_at, created_at)
  on league_seasons to anon, authenticated;

-- Current season. Find the id in the Club Locker URL: clublocker.com/leagues/<id>/home
insert into league_seasons (cl_season_id, name, start_date, end_date, is_current)
values (2625, 'Winter League 2026–2027', '2026-10-20', '2027-03-30', true)
on conflict (cl_season_id) do nothing;
