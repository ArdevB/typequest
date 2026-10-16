-- Behaviour tests for the Phase 7 migration (chaos runs, practice drills).
\set ON_ERROR_STOP 1
\set QUIET 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'chaos@example.com', '{"username":"chaotic"}');
set role service_role;
select public.record_chaos('00000000-0000-0000-0000-0000000000c1',
  '{"combo":"mirror+fog","mods":["mirror","fog"],"seed":5,"score":900,"multiplier":1.75,"wpm":60,"accuracy":95,"duration_ms":30000,"keystroke_log":[]}', 40) - 'xp' as first;
select public.record_chaos('00000000-0000-0000-0000-0000000000c1',
  '{"combo":"","mods":[],"seed":6,"score":700,"multiplier":1,"wpm":70,"accuracy":100,"duration_ms":30000,"keystroke_log":[]}', 30) - 'xp' as other_combo;
select public.record_practice('00000000-0000-0000-0000-0000000000c1', '{"q":{"attempts":10,"errors":2,"avgMs":200}}', 12) ->> 'xp' as after_practice;
reset role;
set role anon;
select username, score, combo from public.chaos_leaderboard(5);
\set ON_ERROR_STOP 0
select public.record_practice('00000000-0000-0000-0000-0000000000c1', '{}', 999);
insert into public.chaos_runs (user_id, combo, seed, score, multiplier, wpm, accuracy, duration_ms, keystroke_log)
  values ('00000000-0000-0000-0000-0000000000c1', 'x', 1, 99999, 9, 300, 100, 1000, '[]');
reset role;
select key, attempts, errors from public.key_stats where user_id = '00000000-0000-0000-0000-0000000000c1';
