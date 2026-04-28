-- Global (site-wide) email campaigns, recipients, and send log

-- Global recipients (site-wide mailing list, not per-tournament)
create table if not exists global_email_recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  type text default 'other' check (type in ('player', 'volunteer', 'invitee', 'other')),
  tags text[] default '{}',
  subscribed boolean default true,
  unsubscribe_token uuid unique default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_global_email_recipients_email on global_email_recipients(email);
create index if not exists idx_global_email_recipients_subscribed on global_email_recipients(subscribed);
create index if not exists idx_global_email_recipients_token on global_email_recipients(unsubscribe_token);

-- Global campaigns
create table if not exists global_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  tags text[] default '{}',
  status text default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  sent_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_global_email_campaigns_status on global_email_campaigns(status);
create index if not exists idx_global_email_campaigns_created_at on global_email_campaigns(created_at desc);

-- Global send log
create table if not exists global_email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references global_email_campaigns(id) on delete cascade,
  recipient_id uuid references global_email_recipients(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_global_email_sends_campaign on global_email_sends(campaign_id);
create index if not exists idx_global_email_sends_recipient on global_email_sends(recipient_id);

-- RLS: admin-only for all global email tables
alter table global_email_recipients enable row level security;
alter table global_email_campaigns enable row level security;
alter table global_email_sends enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'global_email_recipients' and policyname = 'Auth users manage global recipients'
  ) then
    create policy "Auth users manage global recipients"
      on global_email_recipients for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'global_email_campaigns' and policyname = 'Auth users manage global campaigns'
  ) then
    create policy "Auth users manage global campaigns"
      on global_email_campaigns for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'global_email_sends' and policyname = 'Auth users manage global sends'
  ) then
    create policy "Auth users manage global sends"
      on global_email_sends for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
