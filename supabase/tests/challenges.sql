-- Behaviour tests for the Phase 4 migration (streaks, challenges, achievements).
\set ON_ERROR_STOP 1
\set QUIET 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'streak@example.com', '{"username":"streaker"}');

set role service_role;
-- First activity starts a streak; a second one the same day changes nothing.
select public.touch_streak('00000000-0000-0000-0000-0000000000d1') ->> 'streak' as day1;
select public.touch_streak('00000000-0000-0000-0000-0000000000d1') ->> 'changed' as same_day_changed;
reset role;

-- Simulate: yesterday active with a 2-day streak → today makes 3 (milestone, +30 XP).
update public.profiles set last_active_on = public.npt_today() - 1, streak = 2 where username = 'streaker';
set role service_role;
select public.touch_streak('00000000-0000-0000-0000-0000000000d1') - 'best_streak' as milestone3;
reset role;

-- Missed two days with two freezes: streak survives, both freezes spent.
update public.profiles set last_active_on = public.npt_today() - 3, streak = 6, streak_freezes = 2 where username = 'streaker';
set role service_role;
select public.touch_streak('00000000-0000-0000-0000-0000000000d1') - 'best_streak' as freeze_save_to_7;
reset role;

-- Missed two days with one freeze: streak resets.
update public.profiles set last_active_on = public.npt_today() - 3, streak = 10, streak_freezes = 1 where username = 'streaker';
set role service_role;
select public.touch_streak('00000000-0000-0000-0000-0000000000d1') ->> 'streak' as reset_streak;

-- Daily challenge: first pass pays XP once; failed attempts pay nothing.
select public.record_challenge_attempt('00000000-0000-0000-0000-0000000000d1', (public.ensure_daily_challenge()).id, null, null,
  '{"passed":false,"seed":1,"wpm":50,"raw":55,"accuracy":80,"duration_ms":30000,"keystroke_log":[]}', 50) ->> 'xp_awarded' as fail_xp;
select public.record_challenge_attempt('00000000-0000-0000-0000-0000000000d1', (public.ensure_daily_challenge()).id, null, null,
  '{"passed":true,"seed":1,"wpm":61,"raw":63,"accuracy":98,"duration_ms":30000,"keystroke_log":[]}', 50) ->> 'xp_awarded' as first_pass_xp;
select public.record_challenge_attempt('00000000-0000-0000-0000-0000000000d1', (public.ensure_daily_challenge()).id, null, null,
  '{"passed":true,"seed":1,"wpm":70,"raw":72,"accuracy":99,"duration_ms":30000,"keystroke_log":[]}', 50) ->> 'xp_awarded' as second_pass_xp;
select public.record_challenge_attempt('00000000-0000-0000-0000-0000000000d1', null, 'sudden-death', 2,
  '{"passed":true,"seed":5,"wpm":40,"raw":40,"accuracy":100,"duration_ms":30000,"keystroke_log":[]}', 50) ->> 'xp_awarded' as skill_xp;

select public.grant_achievements('00000000-0000-0000-0000-0000000000d1', array['daily-1', 'first-steps', 'not-a-real-one']) - 'xp' as grant1;
select public.grant_achievements('00000000-0000-0000-0000-0000000000d1', array['daily-1']) - 'xp' as grant_again;
select public.player_stats('00000000-0000-0000-0000-0000000000d1') as stats;
reset role;

set role anon;
select username, wpm from public.challenge_leaderboard((select id from public.challenges where day = public.npt_today()), 10);
select count(*) as visible_achievements from public.achievements;
\set ON_ERROR_STOP 0
select public.touch_streak('00000000-0000-0000-0000-0000000000d1');
select public.ensure_daily_challenge(public.npt_today() + 30);
insert into public.user_achievements values ('00000000-0000-0000-0000-0000000000d1', 'graduate');
reset role;
\set ON_ERROR_STOP 1
select username, streak, best_streak, streak_freezes, xp from public.profiles where username = 'streaker';
