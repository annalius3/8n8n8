-- Run this in Supabase SQL Editor (production project).
-- It configures pg_cron + pg_net to call your app scheduler endpoint every 5 minutes.
--
-- 1) Replace placeholders:
--    - YOUR_APP_URL (example: https://8n8n8.vercel.app)
--    - YOUR_SCHEDULER_TOKEN (same value as SCHEDULER_TOKEN in Vercel env)
--
-- 2) Execute the whole script.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove previous job if exists.
do $$
declare
  v_jobid integer;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'autoposting_scheduler_tick'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

-- Schedule every 5 minutes.
select cron.schedule(
  'autoposting_scheduler_tick',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_APP_URL/api/scheduler/tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduler-token', 'YOUR_SCHEDULER_TOKEN'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Check current jobs.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'autoposting_scheduler_tick';

