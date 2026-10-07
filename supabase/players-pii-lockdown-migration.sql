-- Players PII lockdown (run AFTER the code that ships with this file is deployed)
--
-- ORDER MATTERS:
--   1. Deploy the app first. The new code only ever asks the anon/authenticated
--      roles for public player columns, and reads contact/payment fields and
--      volunteers with the service role, so it works before AND after this runs.
--   2. Then run this whole file in the Supabase SQL editor.
--   3. Paste the `report` row back to check it.
-- The editor runs this file as ONE transaction: if any statement errors,
-- NOTHING was applied (no report row is printed). Fix the error and re-run the
-- whole file. The lockdown is done only when the report shows
-- anon_can_select_players_email = false.
-- (Section 4 is the exception: a permission error there is caught, so it
-- skips only the storage change — check match_media_policy_ok in the report.)
-- Running it before the deploy breaks the live court board, player pages and
-- match pages (the old code asks anon for players(*), which fails with 42501).
--
-- What it does:
--   * players     — anon/authenticated may SELECT only the public columns below.
--                   email, phone, payment_status, stripe_session_id (and any
--                   column added later) become service-role only. Writes from
--                   anon/authenticated are revoked too — the app already writes
--                   players only with the service role.
--   * volunteers  — no anon/authenticated access at all (the app uses the
--                   service role for every read and write).
--   * profiles    — signed-in users can read only their own row.
--   * storage match-media — signed-in users can delete only objects they uploaded
--                   (was: any object). No app code deletes from the browser.
--
-- Safe to re-run: privileges are revoked then re-granted, and policies are
-- dropped by querying pg_policies before being recreated.
--
-- Keep the column list in sync with PUBLIC_PLAYER_COLUMNS in
-- src/lib/supabase/types.ts (a unit test checks this file against it).
-- city/rating/ranking/gender/club_locker_id are not granted: they don't exist
-- on the live DB (add-player-extended-fields.sql hasn't been run). If that is
-- run later, those columns start private; grant the ones that should be public
-- (and add them to PUBLIC_PLAYER_COLUMNS) separately.

-- 1. players: column-level SELECT for the public columns only.
alter table public.players enable row level security;

revoke select, insert, update, delete, truncate, references, trigger
  on public.players from anon, authenticated;

grant select (id, tournament_id, name, first_name, last_name, seed, club, draw, created_at)
  on public.players to anon, authenticated;

-- "Public read players" (SELECT using true) stays: it is the row filter that
-- goes with the column grant above.

-- 2. volunteers: service role only.
alter table public.volunteers enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'volunteers'
  loop
    execute format('drop policy %I on public.volunteers', r.policyname);
  end loop;
end $$;

revoke all on public.volunteers from anon, authenticated;

-- 3. profiles: own row only (replaces "Profiles are viewable by authenticated users").
alter table public.profiles enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

create policy "Profiles: read own row"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- 4. storage match-media: uploaders may delete only their own objects.
--    If this role does not own storage.objects, this section is skipped
--    (see 'match_media_policy_ok' in the report) and the rest still applies.
--    The EXCEPTION clause makes this block a subtransaction, so a privilege
--    error rolls back only the storage change. The drop loop and the create
--    stay in the same block so they succeed or fail together.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('DELETE', 'UPDATE')
      and (coalesce(qual, '') ilike '%match-media%' or coalesce(with_check, '') ilike '%match-media%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
  execute $p$create policy "match-media uploader delete own"
    on storage.objects for delete to authenticated
    using (bucket_id = 'match-media' and owner_id = (select auth.uid())::text)$p$;
exception when insufficient_privilege then
  raise warning 'storage.objects policies unchanged (%). Create "match-media uploader delete own" in Dashboard > Storage > Policies.', sqlerrm;
end $$;

-- 5. Verification: paste this result back.
select json_build_object(
  'players_table_grants', (
    select json_agg(json_build_object('grantee', grantee, 'privilege', privilege_type) order by grantee, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'players' and grantee in ('anon', 'authenticated')
  ),
  'players_column_grants', (
    select json_agg(json_build_object('grantee', grantee, 'column', column_name, 'privilege', privilege_type)
                    order by grantee, column_name, privilege_type)
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'players' and grantee in ('anon', 'authenticated')
  ),
  'anon_can_select_players_email', has_column_privilege('anon', 'public.players', 'email', 'select'),            -- expect false
  'authenticated_can_select_players_email', has_column_privilege('authenticated', 'public.players', 'email', 'select'), -- expect false
  'anon_can_select_players_name', has_column_privilege('anon', 'public.players', 'name', 'select'),              -- expect true
  'anon_can_select_volunteers', has_table_privilege('anon', 'public.volunteers', 'select'),                      -- expect false
  'authenticated_can_select_volunteers', has_table_privilege('authenticated', 'public.volunteers', 'select'),    -- expect false
  'match_media_policy_ok', (
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and policyname = 'match-media uploader delete own')
    and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and cmd in ('DELETE','UPDATE') and policyname <> 'match-media uploader delete own'
            and (coalesce(qual,'') ilike '%match-media%' or coalesce(with_check,'') ilike '%match-media%'))
  ),  -- expect true; if false, create the policy in the Dashboard
  'policies', (
    select json_agg(json_build_object(
      'table', schemaname || '.' || tablename, 'policy', policyname,
      'roles', roles, 'cmd', cmd, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies
    where (schemaname = 'public' and tablename in ('players', 'volunteers', 'profiles'))
       or (schemaname = 'storage' and tablename = 'objects'
           and (coalesce(qual, '') ilike '%match-media%' or coalesce(with_check, '') ilike '%match-media%'))
  )
) as report;
