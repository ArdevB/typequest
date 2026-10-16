-- Behaviour tests for the Phase 5 migration (game runs).
\set ON_ERROR_STOP 1
\set QUIET 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'gamer@example.com', '{"username":"gamer"}');
set role service_role;
select public.record_game('00000000-0000-0000-0000-0000000000e1',
  '{"game":"boss-battle","seed":1,"score":6200,"won":true,"wpm":70,"accuracy":97,"duration_ms":60000,"words_done":40,"keystroke_log":[]}', 60) - 'xp' as first;
select public.record_game('00000000-0000-0000-0000-0000000000e1',
  '{"game":"boss-battle","seed":2,"score":5000,"won":true,"wpm":60,"accuracy":95,"duration_ms":70000,"words_done":38,"keystroke_log":[]}', 40) - 'xp' as second;
reset role;
set role anon;
select username, score from public.game_leaderboard('boss-battle', 5);
\set ON_ERROR_STOP 0
select public.record_game('00000000-0000-0000-0000-0000000000e1', '{}', 999);
insert into public.game_runs (user_id, game, seed, score, won, wpm, accuracy, duration_ms, keystroke_log)
  values ('00000000-0000-0000-0000-0000000000e1', 'racing', 1, 99999, true, 300, 100, 1000, '[]');
reset role;

-- Phase 6: Weekly Boss runs and the per-week board.
\set ON_ERROR_STOP 1
set role service_role;
select public.record_game('00000000-0000-0000-0000-0000000000e1',
  '{"game":"weekly-boss","seed":777,"score":9100,"won":true,"wpm":72,"accuracy":96,"duration_ms":80000,"words_done":50,"keystroke_log":[]}', 80) ->> 'is_best' as weekly_first;
select public.record_game('00000000-0000-0000-0000-0000000000e1',
  '{"game":"weekly-boss","seed":778,"score":500,"won":false,"wpm":40,"accuracy":90,"duration_ms":30000,"words_done":10,"keystroke_log":[]}', 10) ->> 'is_best' as other_week;
reset role;
set role anon;
select username, score from public.weekly_boss_leaderboard(777, 5);
select count(*) as other_week_rows from public.weekly_boss_leaderboard(778, 5);
reset role;
\set ON_ERROR_STOP 0
set role service_role;
select public.record_game('00000000-0000-0000-0000-0000000000e1',
  '{"game":"chess","seed":1,"score":1,"won":true,"wpm":1,"accuracy":1,"duration_ms":1,"words_done":1,"keystroke_log":[]}', 0);
reset role;
