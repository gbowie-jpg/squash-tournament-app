-- Security lockdown (2026-10-06)
--
-- Every write to these tables goes through API routes using the service-role
-- client, which bypasses RLS. So policies granting anon/authenticated access are
-- pure exposure. Notably, profiles' "update own row" policy let any signed-in
-- user set their own role to superadmin.
--
-- Drops policies by querying pg_policies, not by name, because the live DB has
-- drifted from the committed migrations. Safe to re-run.

-- 1. Make sure RLS is on everywhere this touches.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'player_videos', 'site_settings', 'push_subscriptions',
    'email_campaigns', 'email_recipients', 'email_sends',
    'global_email_campaigns', 'global_email_recipients', 'global_email_sends'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- 2. Server-only tables: drop every policy (service role still has full access).
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'site_settings', 'push_subscriptions',
        'email_campaigns', 'email_recipients', 'email_sends',
        'global_email_campaigns', 'global_email_recipients', 'global_email_sends'
      )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3. Tables the browser reads but never writes: keep SELECT policies, drop the rest.
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'player_videos')
      and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 4. Prep for the VAPID key rotation: tag each subscription with the key it was created under.
alter table public.push_subscriptions add column if not exists vapid_public_key text;

-- 5. Verification: paste this result back.
select json_build_object(
  'rls', (
    select json_object_agg(c.relname, c.relrowsecurity order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'policies', (
    select json_agg(json_build_object(
      'table', schemaname || '.' || tablename, 'policy', policyname,
      'roles', roles, 'cmd', cmd, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies where schemaname in ('public', 'storage')
  )
) as report;
