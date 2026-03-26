-- Volunteers & Referee signup table
-- Run this in Supabase SQL Editor
create table if not exists volunteers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text default 'referee' check (role in ('referee', 'volunteer', 'helper')),
  notes text,
  created_at timestamptz default now()
);

-- Add referee assignment to matches
alter table matches add column if not exists referee_id uuid references volunteers(id);

-- RLS: public read, public insert (no login needed to sign up)
alter table volunteers enable row level security;

create policy "Volunteers are publicly readable"
  on volunteers for select using (true);

create policy "Anyone can sign up as volunteer"
  on volunteers for insert with check (true);

create policy "Organizers can manage volunteers"
  on volunteers for delete using (
    exists (
      select 1 from organizers
      where organizers.tournament_id = volunteers.tournament_id
      and organizers.user_id = auth.uid()
    )
  );
