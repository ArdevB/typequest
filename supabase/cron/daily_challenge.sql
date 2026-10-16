-- Optional: generate each daily challenge at midnight Nepal time with pg_cron.
-- (The app also creates today's challenge on demand, so this is a safety net.)
-- Supabase: Database → Extensions → enable "pg_cron" first, then run this file.
-- 18:15 UTC = 00:00 in Asia/Kathmandu (UTC+5:45).
select cron.schedule(
  'typequest-daily-challenge',
  '15 18 * * *',
  $$ select public.ensure_daily_challenge(public.npt_today()); $$
);
