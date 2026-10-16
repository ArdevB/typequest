-- TypeQuest Phase 7: online Chaos runs and Practice drills.
-- Both are validated by replaying the keystroke log on the server (seeded
-- words + modifiers, or the rebuilt drill) and written with the service role.

create table if not exists public.chaos_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  combo text not null check (char_length(combo) <= 200),
  mods text[] not null default '{}',
  seed bigint not null,
  score integer not null check (score >= 0),
  multiplier numeric(6, 3) not null,
  wpm numeric(6, 2) not null,
  accuracy numeric(5, 2) not null,
  duration_ms integer not null,
  keystroke_log jsonb not null,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists chaos_runs_board_idx on public.chaos_runs (score desc);
create index if not exists chaos_runs_user_idx on public.chaos_runs (user_id, combo, score desc);

alter table public.chaos_runs enable row level security;
drop policy if exists "Chaos runs are public" on public.chaos_runs;
create policy "Chaos runs are public" on public.chaos_runs for select to anon, authenticated using (true);
revoke insert, update, delete on public.chaos_runs from anon, authenticated;

create or replace function public.record_chaos(p_user uuid, p_run jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prev integer;
  v_top integer;
  v_xp integer;
  v_score integer := (p_run ->> 'score')::integer;
begin
  select max(c.score) into v_prev from public.chaos_runs c where c.user_id = p_user and c.combo = p_run ->> 'combo';
  select max(c.score) into v_top from public.chaos_runs c where c.user_id = p_user;

  insert into public.chaos_runs (user_id, combo, mods, seed, score, multiplier, wpm, accuracy, duration_ms, keystroke_log, xp_awarded)
  values (p_user, p_run ->> 'combo', array(select jsonb_array_elements_text(coalesce(p_run -> 'mods', '[]'::jsonb))),
          (p_run ->> 'seed')::bigint, v_score, (p_run ->> 'multiplier')::numeric, (p_run ->> 'wpm')::numeric,
          (p_run ->> 'accuracy')::numeric, (p_run ->> 'duration_ms')::integer, p_run -> 'keystroke_log', greatest(p_xp, 0));

  update public.profiles set xp = xp + greatest(p_xp, 0) where id = p_user returning xp into v_xp;
  return jsonb_build_object('xp', v_xp, 'xp_awarded', greatest(p_xp, 0), 'previous_best', v_prev,
                            'is_best', v_prev is null or v_score > v_prev,
                            'overall_best', v_top is null or v_score > v_top);
end $$;

-- Each player's best chaos score (any modifier mix).
create or replace function public.chaos_leaderboard(p_limit integer default 20)
returns table ("position" bigint, user_id uuid, username text, level integer, score integer, combo text, multiplier numeric, wpm numeric, played_at timestamptz)
language sql stable set search_path = '' as $$
  with best as (
    select distinct on (c.user_id) c.user_id, c.score, c.combo, c.multiplier, c.wpm, c.created_at
    from public.chaos_runs c
    order by c.user_id, c.score desc, c.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc), b.user_id, p.username, p.level,
         b.score, b.combo, b.multiplier, b.wpm, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- A finished practice drill: merge its per-key stats and add XP.
create or replace function public.record_practice(p_user uuid, p_key_stats jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_xp integer;
begin
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

  update public.profiles set xp = xp + greatest(p_xp, 0) where id = p_user returning xp into v_xp;
  return jsonb_build_object('xp', v_xp, 'xp_awarded', greatest(p_xp, 0));
end $$;

revoke execute on function public.record_chaos(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_chaos(uuid, jsonb, integer) to service_role;
revoke execute on function public.record_practice(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_practice(uuid, jsonb, integer) to service_role;
grant execute on function public.chaos_leaderboard(integer) to anon, authenticated;
