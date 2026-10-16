-- ⚠️ Deletes the TypeQuest tables and ALL their data (profiles, runs, key stats,
-- lesson progress). Use it only to start over on a test project, or when an
-- older/other "profiles" table is in the way. Sign-in accounts (auth.users) are kept.
--
-- After running this, run the files in supabase/migrations again, in order.

-- Phase 5
drop function if exists public.record_game(uuid, jsonb, integer);
drop function if exists public.game_leaderboard(text, integer);
drop table if exists public.game_runs cascade;

-- Phase 4
drop function if exists public.touch_streak(uuid);
drop function if exists public.ensure_daily_challenge(date);
drop function if exists public.record_challenge_attempt(uuid, uuid, text, integer, jsonb, integer);
drop function if exists public.challenge_leaderboard(uuid, integer);
drop function if exists public.grant_achievements(uuid, text[]);
drop function if exists public.player_stats(uuid);
drop table if exists public.user_achievements cascade;
drop table if exists public.achievements cascade;
drop table if exists public.challenge_attempts cascade;
drop table if exists public.challenges cascade;
drop function if exists public.npt_today();

-- Phase 3
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.username_available(text);
drop function if exists public.leaderboard(text, text, integer);
drop function if exists public.record_run(uuid, jsonb, jsonb, integer, integer);
drop function if exists public.record_run(uuid, jsonb, jsonb, integer);
drop function if exists public.record_lesson(uuid, text, integer, numeric, numeric, integer, integer);
drop function if exists public.set_progression(uuid, integer, text);
drop table if exists public.lessons_progress cascade;
drop table if exists public.key_stats cascade;
drop table if exists public.runs cascade;
drop table if exists public.profiles cascade;
drop function if exists public.touch_updated_at() cascade;
