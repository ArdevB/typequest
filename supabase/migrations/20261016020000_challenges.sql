-- TypeQuest Phase 4: daily challenges, skill challenges, achievements, streaks.
-- Run after 20261016000000_core.sql. Same security model: everyone can read,
-- only the server (service role) writes, after replaying and validating runs.

-- ---------------------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists streak_freezes integer not null default 0 check (streak_freezes between 0 and 5);

-- "Today" for streaks and daily challenges is the Nepal calendar day.
create or replace function public.npt_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kathmandu')::date;
$$;

-- Called after any saved activity (run, lesson, challenge). Extends the streak
-- once per day, spends streak freezes to cover missed days, and pays out
-- milestone rewards at 3 / 7 / 30 / 100 days.
create or replace function public.touch_streak(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.npt_today();
  p public.profiles%rowtype;
  v_gap integer;
  v_streak integer;
  v_freezes integer;
  v_used integer := 0;
  v_xp integer := 0;
  v_new_freezes integer := 0;
  v_milestone integer := null;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then return null; end if;

  if p.last_active_on = v_today then
    return jsonb_build_object('streak', p.streak, 'best_streak', p.best_streak, 'freezes', p.streak_freezes,
                              'changed', false, 'milestone', null, 'xp_awarded', 0, 'freezes_used', 0);
  end if;

  v_gap := case when p.last_active_on is null then null else v_today - p.last_active_on end;
  v_freezes := p.streak_freezes;
  if v_gap = 1 then
    v_streak := p.streak + 1;
  elsif v_gap is not null and v_gap > 1 and p.streak > 0 and v_freezes >= v_gap - 1 then
    v_used := v_gap - 1;           -- one freeze per missed day keeps the streak alive
    v_freezes := v_freezes - v_used;
    v_streak := p.streak + 1;
  else
    v_streak := 1;
  end if;

  if v_streak in (3, 7, 30, 100) then
    v_milestone := v_streak;
    v_xp := case v_streak when 3 then 30 when 7 then 75 when 30 then 300 else 1000 end;
    v_new_freezes := case v_streak when 7 then 1 when 30 then 1 when 100 then 2 else 0 end;
  end if;
  v_freezes := least(v_freezes + v_new_freezes, 3);

  update public.profiles set
    streak = v_streak,
    best_streak = greatest(best_streak, v_streak),
    last_active_on = v_today,
    streak_freezes = v_freezes,
    xp = xp + v_xp
  where id = p_user;

  return jsonb_build_object('streak', v_streak, 'best_streak', greatest(p.best_streak, v_streak),
                            'freezes', v_freezes, 'changed', true, 'milestone', v_milestone,
                            'xp_awarded', v_xp, 'freezes_used', v_used, 'freezes_earned', v_new_freezes);
end $$;

-- ---------------------------------------------------------------------------
-- Challenges (daily now; weekly later)
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('daily', 'weekly')),
  day date,
  title text not null,
  description text not null default '',
  -- {"mode":{"kind":"time","seconds":30},"punctuation":false,"numbers":false,"stopOnError":"off"}
  rules jsonb not null,
  -- {"minAccuracy":97}
  goal jsonb not null default '{}'::jsonb,
  -- {"xp":50}
  reward jsonb not null default '{}'::jsonb,
  seed bigint not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (type, day)
);

-- Seven rotating formats; the date picks one and seeds the words, so every
-- player gets exactly the same text and rules.
create or replace function public.ensure_daily_challenge(p_day date default null)
returns public.challenges
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := coalesce(p_day, public.npt_today());
  v_row public.challenges;
  v_slot integer;
  v_title text; v_desc text; v_rules jsonb; v_goal jsonb;
begin
  if v_day > public.npt_today() + 1 or v_day < public.npt_today() - 30 then
    raise exception 'daily challenge date out of range';
  end if;
  select * into v_row from public.challenges where type = 'daily' and day = v_day;
  if found then return v_row; end if;

  v_slot := mod(v_day - date '2026-01-05', 7);   -- 2026-01-05 is a Monday
  if v_slot < 0 then v_slot := v_slot + 7; end if;
  case v_slot
    when 0 then v_title := 'Monday Sprint'; v_desc := '30 seconds, plain words. Pure speed.';
      v_rules := '{"mode":{"kind":"time","seconds":30},"punctuation":false,"numbers":false,"stopOnError":"off"}'; v_goal := '{}';
    when 1 then v_title := 'Precision Tuesday'; v_desc := '50 words. Only runs at 97% accuracy or better count.';
      v_rules := '{"mode":{"kind":"words","count":50},"punctuation":false,"numbers":false,"stopOnError":"off"}'; v_goal := '{"minAccuracy":97}';
    when 2 then v_title := 'Punctuation Wednesday'; v_desc := '60 seconds with capitals and punctuation.';
      v_rules := '{"mode":{"kind":"time","seconds":60},"punctuation":true,"numbers":false,"stopOnError":"off"}'; v_goal := '{}';
    when 3 then v_title := 'Numbers Thursday'; v_desc := '30 seconds with numbers mixed in.';
      v_rules := '{"mode":{"kind":"time","seconds":30},"punctuation":false,"numbers":true,"stopOnError":"off"}'; v_goal := '{}';
    when 4 then v_title := 'Clean Friday'; v_desc := '25 words. You can''t leave a word until it''s right.';
      v_rules := '{"mode":{"kind":"words","count":25},"punctuation":false,"numbers":false,"stopOnError":"word"}'; v_goal := '{"minAccuracy":95}';
    when 5 then v_title := 'Saturday Endurance'; v_desc := 'Two full minutes. Pace yourself.';
      v_rules := '{"mode":{"kind":"time","seconds":120},"punctuation":false,"numbers":false,"stopOnError":"off"}'; v_goal := '{"minAccuracy":90}';
    else v_title := 'Sunday Full Text'; v_desc := '50 words with punctuation and numbers.';
      v_rules := '{"mode":{"kind":"words","count":50},"punctuation":true,"numbers":true,"stopOnError":"off"}'; v_goal := '{}';
  end case;

  insert into public.challenges (type, day, title, description, rules, goal, reward, seed, starts_at, ends_at)
  values ('daily', v_day, v_title, v_desc, v_rules, v_goal, '{"xp":50}',
          ('x' || substr(md5('typequest-daily-' || v_day::text), 1, 8))::bit(32)::bigint,
          v_day::timestamp at time zone 'Asia/Kathmandu',
          (v_day + 1)::timestamp at time zone 'Asia/Kathmandu')
  on conflict (type, day) do nothing;

  select * into v_row from public.challenges where type = 'daily' and day = v_day;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Challenge attempts (daily runs and skill-challenge clears)
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete cascade,
  skill_id text check (char_length(skill_id) <= 40),
  tier smallint check (tier between 1 and 3),
  passed boolean not null,
  seed bigint not null,
  wpm numeric(6, 2) not null,
  raw numeric(6, 2) not null,
  accuracy numeric(5, 2) not null,
  duration_ms integer not null,
  keystroke_log jsonb not null,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  check (challenge_id is not null or (skill_id is not null and tier is not null))
);
create index if not exists challenge_attempts_board_idx on public.challenge_attempts (challenge_id, wpm desc) where passed;
create index if not exists challenge_attempts_user_idx on public.challenge_attempts (user_id, created_at desc);

-- Records a validated attempt. XP only for the first pass of a daily challenge
-- or of a skill tier.
create or replace function public.record_challenge_attempt(
  p_user uuid, p_challenge uuid, p_skill text, p_tier integer, p_attempt jsonb, p_xp_first integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_passed boolean := coalesce((p_attempt ->> 'passed')::boolean, false);
  v_first boolean;
  v_gain integer := 0;
  v_xp integer;
begin
  if p_challenge is not null then
    v_first := not exists (select 1 from public.challenge_attempts a
                           where a.user_id = p_user and a.challenge_id = p_challenge and a.passed);
  else
    v_first := not exists (select 1 from public.challenge_attempts a
                           where a.user_id = p_user and a.skill_id = p_skill and a.tier = p_tier and a.passed);
  end if;
  if v_passed and v_first then v_gain := greatest(p_xp_first, 0); end if;

  insert into public.challenge_attempts (user_id, challenge_id, skill_id, tier, passed, seed, wpm, raw, accuracy,
                                         duration_ms, keystroke_log, xp_awarded)
  values (p_user, p_challenge, p_skill, p_tier, v_passed, (p_attempt ->> 'seed')::bigint,
          (p_attempt ->> 'wpm')::numeric, (p_attempt ->> 'raw')::numeric, (p_attempt ->> 'accuracy')::numeric,
          (p_attempt ->> 'duration_ms')::integer, p_attempt -> 'keystroke_log', v_gain);

  update public.profiles set xp = xp + v_gain where id = p_user returning xp into v_xp;
  return jsonb_build_object('xp', v_xp, 'xp_awarded', v_gain, 'first_pass', v_passed and v_first);
end $$;

-- Best passed attempt per player for one challenge.
create or replace function public.challenge_leaderboard(p_challenge uuid, p_limit integer default 50)
returns table ("position" bigint, user_id uuid, username text, level integer, rank text,
               wpm numeric, accuracy numeric, attempt_at timestamptz)
language sql stable set search_path = '' as $$
  with best as (
    select distinct on (a.user_id) a.user_id, a.wpm, a.accuracy, a.created_at
    from public.challenge_attempts a
    where a.challenge_id = p_challenge and a.passed
    order by a.user_id, a.wpm desc, a.created_at asc
  )
  select row_number() over (order by b.wpm desc, b.created_at asc), b.user_id, p.username, p.level, p.rank,
         b.wpm, b.accuracy, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.wpm desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Achievements (definitions mirror src/achievements/catalog.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  category text not null,
  hidden boolean not null default false,
  xp integer not null default 0,
  sort integer not null default 0
);

insert into public.achievements (id, name, description, category, hidden, xp, sort) values
  ('first-steps', 'First Steps', 'Finish your first speed test.', 'speed', false, 10, 1),
  ('wpm-40', 'Getting Warm', 'Reach 40 WPM in a speed test.', 'speed', false, 20, 2),
  ('wpm-60', 'Quick Fingers', 'Reach 60 WPM in a speed test.', 'speed', false, 30, 3),
  ('wpm-80', 'Speedster', 'Reach 80 WPM in a speed test.', 'speed', false, 50, 4),
  ('wpm-100', 'Triple Digits', 'Reach 100 WPM in a speed test.', 'speed', false, 80, 5),
  ('wpm-120', 'Blur', 'Reach 120 WPM in a speed test.', 'speed', false, 120, 6),
  ('flawless', 'Flawless', 'Finish a test of 25+ words with 100% accuracy.', 'accuracy', false, 40, 7),
  ('metronome', 'Metronome', 'Score 90%+ consistency in a test of 30 seconds or more.', 'accuracy', false, 40, 8),
  ('combo-50', 'On a Roll', 'Reach a 50-key combo.', 'combo', false, 20, 9),
  ('combo-100', 'Unstoppable', 'Reach a 100-key combo.', 'combo', false, 40, 10),
  ('combo-250', 'In the Zone', 'Reach a 250-key combo.', 'combo', false, 80, 11),
  ('home-row-hero', 'Home Row Hero', 'Pass every Home row lesson.', 'learn', false, 30, 12),
  ('alphabet', 'The Whole Alphabet', 'Pass every lesson up to the end of the Bottom row.', 'learn', false, 50, 13),
  ('graduate', 'Graduate', 'Pass all 32 lessons.', 'learn', false, 100, 14),
  ('star-collector', 'Star Collector', 'Earn 3 stars on 10 lessons.', 'learn', false, 50, 15),
  ('tests-10', 'Warming Up', 'Finish 10 speed tests.', 'dedication', false, 20, 16),
  ('tests-100', 'Regular', 'Finish 100 speed tests.', 'dedication', false, 60, 17),
  ('tests-1000', 'Keyboard Warrior', 'Finish 1,000 speed tests.', 'dedication', false, 200, 18),
  ('streak-7', 'One Week Strong', 'Keep a 7-day streak.', 'dedication', false, 50, 19),
  ('streak-30', 'Habit Formed', 'Keep a 30-day streak.', 'dedication', false, 150, 20),
  ('streak-100', 'Unbreakable', 'Keep a 100-day streak.', 'dedication', false, 400, 21),
  ('daily-1', 'Daily Debut', 'Complete a daily challenge.', 'challenge', false, 20, 22),
  ('daily-7', 'Daily Devotee', 'Complete 7 daily challenges.', 'challenge', false, 60, 23),
  ('skill-gold', 'Gold Standard', 'Clear any skill challenge on gold.', 'challenge', false, 60, 24),
  ('all-skills', 'Jack of All Keys', 'Clear every skill challenge on any tier.', 'challenge', false, 80, 25),
  ('night-owl', 'Night Owl', 'Finish a test between midnight and 4 AM.', 'fun', true, 15, 26),
  ('early-bird', 'Early Bird', 'Finish a test between 5 and 7 AM.', 'fun', true, 15, 27),
  ('the-answer', 'The Answer', 'Finish a test at exactly 42 WPM.', 'fun', true, 42, 28),
  ('photo-finish', 'Photo Finish', 'Beat your personal best by less than half a WPM.', 'fun', true, 25, 29),
  ('slow-and-steady', 'Slow and Steady', '100% accuracy in a 60s+ test under 30 WPM.', 'fun', true, 20, 30),
  ('backspace-hero', 'Backspace Hero', 'Fix 30+ mistakes in one test and still finish at 95%+ accuracy.', 'fun', true, 25, 31)
on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category,
  hidden = excluded.hidden, xp = excluded.xp, sort = excluded.sort;

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- Grants achievements (ignoring ones already held) and their XP. Returns the new ids.
create or replace function public.grant_achievements(p_user uuid, p_ids text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_new text[];
  v_gain integer;
  v_xp integer;
begin
  with ins as (
    insert into public.user_achievements (user_id, achievement_id)
    select p_user, a.id from public.achievements a where a.id = any(p_ids)
    on conflict do nothing
    returning achievement_id
  )
  select coalesce(array_agg(achievement_id), '{}') into v_new from ins;

  select coalesce(sum(a.xp), 0) into v_gain from public.achievements a where a.id = any(v_new);
  update public.profiles set xp = xp + v_gain where id = p_user returning xp into v_xp;
  return jsonb_build_object('new', to_jsonb(v_new), 'xp_awarded', v_gain, 'xp', v_xp);
end $$;

-- Everything the achievement rules need to know about a player, in one call.
create or replace function public.player_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'runs', (select count(*) from public.runs r where r.user_id = p_user),
    'daily_passed', (select count(distinct a.challenge_id) from public.challenge_attempts a
                     where a.user_id = p_user and a.passed and a.challenge_id is not null),
    'skill_tiers', coalesce((select jsonb_agg(distinct jsonb_build_object('skill', a.skill_id, 'tier', a.tier))
                     from public.challenge_attempts a where a.user_id = p_user and a.passed and a.skill_id is not null), '[]'),
    'lessons', coalesce((select jsonb_object_agg(lp.lesson_id, lp.stars) from public.lessons_progress lp
                     where lp.user_id = p_user), '{}'),
    'best_streak', (select p.best_streak from public.profiles p where p.id = p_user),
    'streak', (select p.streak from public.profiles p where p.id = p_user),
    'xp', (select p.xp from public.profiles p where p.id = p_user),
    'rating_wpm', (select p.rating_wpm from public.profiles p where p.id = p_user),
    'owned', coalesce((select jsonb_agg(ua.achievement_id) from public.user_achievements ua where ua.user_id = p_user), '[]')
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security & grants
-- ---------------------------------------------------------------------------
alter table public.challenges enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Challenges are public" on public.challenges;
create policy "Challenges are public" on public.challenges for select to anon, authenticated using (true);
drop policy if exists "Challenge attempts are public" on public.challenge_attempts;
create policy "Challenge attempts are public" on public.challenge_attempts for select to anon, authenticated using (true);
drop policy if exists "Achievements are public" on public.achievements;
create policy "Achievements are public" on public.achievements for select to anon, authenticated using (true);
drop policy if exists "Unlocked achievements are public" on public.user_achievements;
create policy "Unlocked achievements are public" on public.user_achievements for select to anon, authenticated using (true);

revoke insert, update, delete on public.challenges, public.challenge_attempts, public.achievements, public.user_achievements
  from anon, authenticated;

revoke execute on function public.touch_streak(uuid) from public, anon, authenticated;
revoke execute on function public.record_challenge_attempt(uuid, uuid, text, integer, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.grant_achievements(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.player_stats(uuid) from public, anon, authenticated;
grant execute on function public.touch_streak(uuid) to service_role;
grant execute on function public.record_challenge_attempt(uuid, uuid, text, integer, jsonb, integer) to service_role;
grant execute on function public.grant_achievements(uuid, text[]) to service_role;
grant execute on function public.player_stats(uuid) to service_role;

-- Creating today's (or tomorrow's) challenge is deterministic, so anyone may trigger it.
grant execute on function public.ensure_daily_challenge(date) to anon, authenticated, service_role;
grant execute on function public.challenge_leaderboard(uuid, integer) to anon, authenticated;
grant execute on function public.npt_today() to anon, authenticated, service_role;

-- Create today's challenge right away.
select public.ensure_daily_challenge();
