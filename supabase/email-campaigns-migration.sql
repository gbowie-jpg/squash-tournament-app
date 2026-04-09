-- Email campaigns and recipients for tournament marketing
-- Run at: https://supabase.com/dashboard/project/rhrkkwvrehntnqqadehq/sql/new

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  subject text not null,
  body text not null,
  status text default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  sent_count int default 0,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists email_recipients (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  email text not null,
  type text default 'invitee' check (type in ('invitee', 'player', 'volunteer', 'other')),
  subscribed boolean default true,
  created_at timestamptz default now()
);

create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id) on delete cascade,
  recipient_id uuid references email_recipients(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Unique constraint for upsert deduplication
alter table email_recipients add constraint email_recipients_tournament_email_unique
  unique (tournament_id, email);

-- Indexes
create index if not exists idx_email_recipients_tournament on email_recipients(tournament_id);
create index if not exists idx_email_campaigns_tournament on email_campaigns(tournament_id);
create index if not exists idx_email_sends_campaign on email_sends(campaign_id);

-- RLS
alter table email_campaigns enable row level security;
alter table email_recipients enable row level security;
alter table email_sends enable row level security;

-- Policies: authenticated users can manage campaigns/recipients
do $$
begin
  if not exists (select 1 from pg_policies where tablename='email_campaigns' and policyname='Auth users manage campaigns') then
    create policy "Auth users manage campaigns" on email_campaigns for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='email_recipients' and policyname='Auth users manage recipients') then
    create policy "Auth users manage recipients" on email_recipients for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='email_sends' and policyname='Auth users view sends') then
    create policy "Auth users view sends" on email_sends for all using (auth.role() = 'authenticated');
  end if;
end $$;
