-- Behaviour tests for the core migration. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Two users sign up; profiles are created by the trigger, with unique usernames.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"username":"ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bo@example.com', '{"username":"ANA"}'),
  ('00000000-0000-0000-0000-00000000000c', 'x@example.com', '{"username":"a!"}');
select username from public.profiles order by created_at, username;

-- Server records runs through the service role.
set role service_role;
select public.record_run('00000000-0000-0000-0000-00000000000a',
  '{"mode":"time","mode_value":30,"seed":1,"wpm":61.5,"raw":64,"accuracy":97,"consistency":80,"duration_ms":30000,"chars":{},"max_combo":40,"keystroke_log":[],"client_id":"c1"}',
  '{"a":{"attempts":10,"errors":1,"avgMs":120},"b":{"attempts":4,"errors":0,"avgMs":200}}', 25) ->> 'is_pb' as first_is_pb;
select public.record_run('00000000-0000-0000-0000-00000000000a',
  '{"mode":"time","mode_value":30,"seed":2,"wpm":70,"raw":72,"accuracy":98,"consistency":85,"duration_ms":30000,"chars":{},"keystroke_log":[]}',
  '{"a":{"attempts":10,"errors":0,"avgMs":100}}', 30, 20) - 'run_id' as second_with_pb_bonus;
select public.record_run('00000000-0000-0000-0000-00000000000a',
  '{"mode":"time","mode_value":30,"seed":1,"wpm":61.5,"raw":64,"accuracy":97,"consistency":80,"duration_ms":30000,"chars":{},"keystroke_log":[],"client_id":"c1"}',
  '{}', 25) ->> 'duplicate' as dup;
select public.record_run('00000000-0000-0000-0000-00000000000b',
  '{"mode":"time","mode_value":30,"seed":3,"wpm":88,"raw":90,"accuracy":99,"consistency":90,"duration_ms":30000,"chars":{},"keystroke_log":[]}', '{}', 40) ->> 'xp' as bo_xp;
select key, attempts, errors, avg_ms from public.key_stats where user_id = '00000000-0000-0000-0000-00000000000a' order by key;
select public.record_lesson('00000000-0000-0000-0000-00000000000a', 'home-fj', 2, 20, 95, 5, 10) as lesson1;
select public.record_lesson('00000000-0000-0000-0000-00000000000a', 'home-fj', 3, 30, 99, 5, 10) as lesson2;
select public.record_lesson('00000000-0000-0000-0000-00000000000a', 'home-fj', 1, 10, 88, 5, 10) as lesson3;
select public.set_progression('00000000-0000-0000-0000-00000000000a', 3, 'gold');
select username, xp, level, rank, rating_wpm from public.profiles order by username;
reset role;

-- Anyone can read the leaderboard.
set role anon;
select "position", username, wpm from public.leaderboard('time-30', 'all', 10);
select count(*) as day_rows from public.leaderboard('time-30', 'day', 10);
select public.username_available('ana') as ana_free, public.username_available('newname') as new_free;

-- Anonymous users cannot write anything or call server functions.
\set ON_ERROR_STOP 0
insert into public.runs (user_id, mode, mode_value, seed, wpm, raw, accuracy, consistency, duration_ms, chars, keystroke_log)
  values ('00000000-0000-0000-0000-00000000000a', 'time', 30, 1, 300, 300, 100, 100, 30000, '{}', '[]');
select public.record_run('00000000-0000-0000-0000-00000000000a', '{}', '{}', 1000);
reset role;

-- Signed-in user: may rename themselves and change theme, nothing else.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.profiles set username = 'ana_types', selected_theme = 'minimal-calm' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set xp = 999999 where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set selected_theme = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select count(*) as own_key_stats from public.key_stats;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select count(*) as others_key_stats_visible from public.key_stats;
select count(*) as others_lessons_visible from public.lessons_progress;
delete from public.runs;
insert into public.lessons_progress (user_id, lesson_id, stars) values ('00000000-0000-0000-0000-00000000000b', 'x', 3);
reset role;
\set ON_ERROR_STOP 1

select username, xp, selected_theme from public.profiles order by username;
select count(*) as runs_total from public.runs;
