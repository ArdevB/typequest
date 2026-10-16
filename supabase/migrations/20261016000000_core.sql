-- TypeQuest core schema (Phase 3): profiles, runs, key stats, lesson progress.
--
-- Security model
-- * Row Level Security is on for every table.
-- * Anyone may read profiles and runs (leaderboards, public profiles).
-- * Clients never write runs, key stats, lesson progress, XP or rank directly.
--   The Next.js API replays each keystroke log with the typing engine, rejects
--   impossible or pasted input, then writes through the service role using the
--   record_* functions below (which only the service role may execute).
-- * Signed-in users may change only their own username and theme.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  rank text not null default 'unranked'
    check (rank in ('unranked', 'bronze', 'silver', 'gold', 'diamond', 'master')),
  rating_wpm numeric(6, 2) not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_active_on date,
  selected_theme text not null default 'neon-cyber' check (char_length(selected_theme) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user. The username comes from sign-up
-- metadata (or the email name), cleaned up and made unique.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  tries integer := 0;
begin
  base := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1), ''),
    '[^A-Za-z0-9_]', '', 'g');
  if char_length(base) < 3 then base := 'typist'; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) loop
    tries := tries + 1;
    candidate := left(base, 15) || (1000 + floor(random() * 9000))::integer::text;
    if tries > 25 then
      candidate := 'typist' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form check a name before submitting.
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username));
$$;

-- ---------------------------------------------------------------------------
-- Runs (speed tests)
-- ---------------------------------------------------------------------------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Set for runs synced from a guest's browser so a run is never stored twice.
  client_id text check (char_length(client_id) <= 64),
  mode text not null check (mode in ('time', 'words')),
  mode_value integer not null check (mode_value > 0),
  mode_key text generated always as (mode || '-' || mode_value::text) stored,
  punctuation boolean not null default false,
  numbers boolean not null default false,
  seed bigint not null,
  wpm numeric(6, 2) not null check (wpm >= 0),
  raw numeric(6, 2) not null check (raw >= 0),
  accuracy numeric(5, 2) not null check (accuracy between 0 and 100),
  consistency numeric(5, 2) not null check (consistency between 0 and 100),
  duration_ms integer not null check (duration_ms > 0),
  chars jsonb not null,
  max_combo integer not null default 0,
  keystroke_log jsonb not null,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index runs_leaderboard_idx on public.runs (mode_key, wpm desc, created_at)
  where not punctuation and not numbers;
create index runs_user_recent_idx on public.runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Per-key stats (adaptive practice, heatmap)
-- ---------------------------------------------------------------------------
create table public.key_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 2),
  attempts integer not null default 0,
  errors integer not null default 0,
  avg_ms numeric(8, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Lesson progress
-- ---------------------------------------------------------------------------
create table public.lessons_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 40),
  stars smallint not null default 0 check (stars between 0 and 3),
  best_wpm numeric(6, 2) not null default 0,
  best_accuracy numeric(5, 2) not null default 0,
  attempts integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.key_stats enable row level security;
alter table public.lessons_progress enable row level security;

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Runs are public" on public.runs
  for select to anon, authenticated using (true);

create policy "Users read their own key stats" on public.key_stats
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own lesson progress" on public.lessons_progress
  for select to authenticated using ((select auth.uid()) = user_id);

-- Column-level limits: users can only rename themselves and pick a theme.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, selected_theme) on public.profiles to authenticated;
revoke insert, update, delete on public.runs, public.key_stats, public.lessons_progress from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard: each user's best run for a mode, in a period.
-- Periods use Asia/Kathmandu days and weeks.
-- ---------------------------------------------------------------------------
create function public.leaderboard(p_mode_key text, p_period text default 'all', p_limit integer default 50)
returns table (
  "position" bigint,
  user_id uuid,
  username text,
  level integer,
  rank text,
  wpm numeric,
  accuracy numeric,
  raw numeric,
  run_at timestamptz
)
language sql stable set search_path = '' as $$
  with since as (
    select case p_period
      when 'day' then date_trunc('day', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu'
      when 'week' then date_trunc('week', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu'
      else '-infinity'::timestamptz
    end as t
  ),
  best as (
    select distinct on (r.user_id) r.user_id, r.wpm, r.accuracy, r.raw, r.created_at
    from public.runs r, since
    where r.mode_key = p_mode_key
      and not r.punctuation and not r.numbers
      and r.created_at >= since.t
    order by r.user_id, r.wpm desc, r.created_at asc
  )
  select row_number() over (order by b.wpm desc, b.created_at asc),
         b.user_id, p.username, p.level, p.rank, b.wpm, b.accuracy, b.raw, b.created_at
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.wpm desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Server-only write functions (called by the API with the service role).
-- ---------------------------------------------------------------------------

-- Stores a validated run, merges per-key stats, adds XP (plus p_pb_bonus when
-- it beats an earlier best) and refreshes the rating (average of the best 3
-- plain time runs of 30s or more).
create function public.record_run(p_user uuid, p_run jsonb, p_key_stats jsonb, p_xp integer, p_pb_bonus integer default 0)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_run_id uuid;
  v_prev_best numeric;
  v_xp integer;
  v_rating numeric;
  v_gain integer;
  v_mode_key text := (p_run ->> 'mode') || '-' || (p_run ->> 'mode_value');
begin
  if p_run ? 'client_id' and exists (
    select 1 from public.runs r where r.user_id = p_user and r.client_id = p_run ->> 'client_id'
  ) then
    return jsonb_build_object('duplicate', true);
  end if;

  select max(r.wpm) into v_prev_best
  from public.runs r
  where r.user_id = p_user and r.mode_key = v_mode_key
    and r.punctuation = coalesce((p_run ->> 'punctuation')::boolean, false)
    and r.numbers = coalesce((p_run ->> 'numbers')::boolean, false);

  v_gain := greatest(p_xp, 0)
            + case when v_prev_best is not null and (p_run ->> 'wpm')::numeric > v_prev_best
                   then greatest(p_pb_bonus, 0) else 0 end;

  insert into public.runs (
    user_id, client_id, mode, mode_value, punctuation, numbers, seed, wpm, raw, accuracy,
    consistency, duration_ms, chars, max_combo, keystroke_log, xp_awarded, created_at
  ) values (
    p_user,
    p_run ->> 'client_id',
    p_run ->> 'mode',
    (p_run ->> 'mode_value')::integer,
    coalesce((p_run ->> 'punctuation')::boolean, false),
    coalesce((p_run ->> 'numbers')::boolean, false),
    (p_run ->> 'seed')::bigint,
    (p_run ->> 'wpm')::numeric,
    (p_run ->> 'raw')::numeric,
    (p_run ->> 'accuracy')::numeric,
    (p_run ->> 'consistency')::numeric,
    (p_run ->> 'duration_ms')::integer,
    p_run -> 'chars',
    coalesce((p_run ->> 'max_combo')::integer, 0),
    p_run -> 'keystroke_log',
    v_gain,
    coalesce((p_run ->> 'created_at')::timestamptz, now())
  )
  returning id into v_run_id;

  insert into public.key_stats as ks (user_id, key, attempts, errors, avg_ms)
  select p_user, e.key, (e.value ->> 'attempts')::integer, (e.value ->> 'errors')::integer,
         coalesce((e.value ->> 'avgMs')::numeric, 0)
  from jsonb_each(coalesce(p_key_stats, '{}'::jsonb)) as e
  where char_length(e.key) between 1 and 2
  on conflict (user_id, key) do update set
    avg_ms = case when ks.attempts + excluded.attempts = 0 then 0
                  else (ks.avg_ms * ks.attempts + excluded.avg_ms * excluded.attempts)
                       / (ks.attempts + excluded.attempts) end,
    attempts = ks.attempts + excluded.attempts,
    errors = ks.errors + excluded.errors,
    updated_at = now();

  select coalesce(avg(t.wpm), 0) into v_rating
  from (
    select r.wpm from public.runs r
    where r.user_id = p_user and r.mode = 'time' and r.mode_value >= 30
      and not r.punctuation and not r.numbers
    order by r.wpm desc limit 3
  ) t;

  update public.profiles
  set xp = xp + v_gain, rating_wpm = v_rating
  where id = p_user
  returning xp into v_xp;

  return jsonb_build_object(
    'duplicate', false,
    'run_id', v_run_id,
    'xp', v_xp,
    'xp_awarded', v_gain,
    'rating_wpm', v_rating,
    'previous_best', v_prev_best,
    'is_pb', v_prev_best is null or (p_run ->> 'wpm')::numeric > v_prev_best
  );
end $$;

-- Stores a validated lesson attempt. XP: p_pass_xp for any passed attempt plus
-- p_star_xp for every star earned for the first time.
create function public.record_lesson(
  p_user uuid, p_lesson_id text, p_stars integer, p_wpm numeric, p_accuracy numeric,
  p_pass_xp integer, p_star_xp integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prev integer;
  v_gain integer;
  v_xp integer;
begin
  select lp.stars into v_prev from public.lessons_progress lp
  where lp.user_id = p_user and lp.lesson_id = p_lesson_id;
  v_prev := coalesce(v_prev, 0);
  v_gain := case when p_stars > 0 then p_pass_xp else 0 end
            + greatest(p_stars - v_prev, 0) * p_star_xp;

  insert into public.lessons_progress as lp (user_id, lesson_id, stars, best_wpm, best_accuracy, attempts, completed_at)
  values (p_user, p_lesson_id, p_stars,
          case when p_stars > 0 then p_wpm else 0 end,
          case when p_stars > 0 then p_accuracy else 0 end,
          1, case when p_stars > 0 then now() end)
  on conflict (user_id, lesson_id) do update set
    stars = greatest(lp.stars, excluded.stars),
    best_wpm = greatest(lp.best_wpm, excluded.best_wpm),
    best_accuracy = greatest(lp.best_accuracy, excluded.best_accuracy),
    attempts = lp.attempts + 1,
    completed_at = coalesce(lp.completed_at, excluded.completed_at),
    updated_at = now();

  update public.profiles set xp = xp + v_gain where id = p_user returning xp into v_xp;

  return jsonb_build_object('xp_awarded', v_gain, 'xp', v_xp, 'previous_stars', v_prev,
                            'stars', greatest(v_prev, p_stars));
end $$;

-- Level and rank are derived in TypeScript (src/lib/progression.ts) and saved here.
create function public.set_progression(p_user uuid, p_level integer, p_rank text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set level = greatest(p_level, 1), rank = p_rank where id = p_user;
$$;

revoke execute on function public.record_run(uuid, jsonb, jsonb, integer, integer) from public, anon, authenticated;
revoke execute on function public.record_lesson(uuid, text, integer, numeric, numeric, integer, integer) from public, anon, authenticated;
revoke execute on function public.set_progression(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.record_run(uuid, jsonb, jsonb, integer, integer) to service_role;
grant execute on function public.record_lesson(uuid, text, integer, numeric, numeric, integer, integer) to service_role;
grant execute on function public.set_progression(uuid, integer, text) to service_role;

grant execute on function public.leaderboard(text, text, integer) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
