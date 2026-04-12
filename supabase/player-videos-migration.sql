-- Player videos table
-- Players can upload highlight videos; admins approve before public display

create table if not exists player_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade not null,
  tournament_id uuid references tournaments(id) on delete cascade not null,
  title text,
  description text,
  storage_path text not null,          -- Supabase storage path
  public_url text,                     -- Full public URL after upload
  thumbnail_url text,
  duration_seconds int,
  file_size_bytes bigint,
  mime_type text default 'video/mp4',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  uploaded_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for common queries
create index if not exists player_videos_player_id_idx on player_videos(player_id);
create index if not exists player_videos_tournament_id_idx on player_videos(tournament_id);
create index if not exists player_videos_status_idx on player_videos(status);

-- RLS: public can view approved videos
alter table player_videos enable row level security;

create policy "Public can view approved videos"
  on player_videos for select
  using (status = 'approved');

create policy "Authenticated users can insert their own videos"
  on player_videos for insert
  with check (auth.uid() = uploaded_by);

create policy "Authenticated users can view their own videos"
  on player_videos for select
  using (auth.uid() = uploaded_by);

-- Storage bucket (run this in Supabase dashboard or SQL editor)
-- insert into storage.buckets (id, name, public) values ('player-videos', 'player-videos', true)
-- on conflict do nothing;

-- Storage policy: authenticated users can upload
-- create policy "Authenticated users can upload videos"
--   on storage.objects for insert
--   with check (bucket_id = 'player-videos' and auth.role() = 'authenticated');

-- create policy "Public can view approved videos"
--   on storage.objects for select
--   using (bucket_id = 'player-videos');
