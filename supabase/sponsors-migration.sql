-- Sponsors table: per-tournament sponsor management
create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  logo_url text,
  url text,
  tier text not null check (tier in ('title','court','supporting')),
  court_id uuid references courts(id) on delete set null,
  display_order int default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsors_tournament_idx on sponsors(tournament_id);
create index if not exists sponsors_court_idx on sponsors(court_id);

alter table sponsors enable row level security;

-- Public read for active sponsors (tournament landing/court board)
drop policy if exists "sponsors_select_public" on sponsors;
create policy "sponsors_select_public" on sponsors for select using (true);

-- Service role bypasses RLS automatically; admin writes go through API
