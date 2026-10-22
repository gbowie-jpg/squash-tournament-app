-- Schedules the Club Locker league sync. Run AFTER league-migration.sql and
-- after LEAGUE_SYNC_SECRET is set in Vercel and deployed.
--
-- Replace <LEAGUE_SYNC_SECRET> below with the same value as the Vercel env var
-- when you paste this into the SQL editor. Don't commit the real value.
-- The job runs every 5 minutes; /api/league/sync decides whether a full sync
-- (hourly), a live sync (league nights, every ~5 min) or nothing is due.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running replaces the job.
select cron.unschedule('league-sync') where exists (select 1 from cron.job where jobname = 'league-sync');

select cron.schedule(
  'league-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://squash-tournament-app.vercel.app/api/league/sync?mode=auto',
    headers := jsonb_build_object('Authorization', 'Bearer <LEAGUE_SYNC_SECRET>'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Check it's running:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'league-sync') order by start_time desc limit 5;
--   select id, status_code, left(content, 300) from net._http_response order by id desc limit 5;
