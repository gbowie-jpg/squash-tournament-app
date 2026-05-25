-- Messages inbox system
-- Run this in the Supabase dashboard SQL editor

create table if not exists messages (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text        not null,
  tournament_id uuid       references tournaments(id) on delete set null,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists messages_created_at_idx on messages (created_at desc);

-- Read receipts: one row per (message, user) pair
create table if not exists message_reads (
  id         uuid        primary key default gen_random_uuid(),
  message_id uuid        not null references messages(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  read_at    timestamptz not null default now(),
  unique(message_id, user_id)
);

create index if not exists message_reads_user_idx on message_reads (user_id);

-- RLS
alter table messages     enable row level security;
alter table message_reads enable row level security;

-- All authenticated users can read messages
create policy "Auth users read messages" on messages
  for select to authenticated using (true);

-- message_reads: users can only see/insert their own rows
create policy "Users read own reads" on message_reads
  for select to authenticated using (auth.uid() = user_id);

create policy "Users insert own reads" on message_reads
  for insert to authenticated with check (auth.uid() = user_id);
