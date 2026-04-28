-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_endpoint on push_subscriptions(endpoint);

alter table push_subscriptions enable row level security;

-- Push subscriptions are managed via the service role only (API routes use admin client)
-- No direct client access needed
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'push_subscriptions' and policyname = 'Service role manages push subscriptions'
  ) then
    create policy "Service role manages push subscriptions"
      on push_subscriptions for all
      using (true)
      with check (true);
  end if;
end $$;
