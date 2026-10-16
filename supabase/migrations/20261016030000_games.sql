-- TypeQuest Phase 5: game modes (Falling Words, Boss Battle, Racing, Stickman Duel).
-- Games are validated like runs: the server replays the seed + keystroke log
-- through the same game simulation, then writes the result with the service role.

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('falling-words', 'boss-battle', 'racing', 'stickman-duel')),
  seed bigint not null,
  score integer not null check (score >= 0),
  won boolean not null,
  wpm numeric(6, 2) not null,
  accuracy numeric(5, 2) not null,
  duration_ms integer not null,
  words_done integer not null default 0,
  keystroke_log jsonb not null,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists game_runs_board_idx on public.game_runs (game, score desc);
create index if not exists game_runs_user_idx on public.game_runs (user_id, created_at desc);

alter table public.game_runs enable row level security;
drop policy if exists "Game runs are public" on public.game_runs;
create policy "Game runs are public" on public.game_runs for select to anon, authenticated using (true);
revoke insert, update, delete on public.game_runs from anon, authenticated;

create or replace function public.record_game(p_user uuid, p_run jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prev integer;
  v_xp integer;
begin
  select max(g.score) into v_prev from public.game_runs g
  where g.user_id = p_user and g.game = p_run ->> 'game';

  insert into public.game_runs (user_id, game, seed, score, won, wpm, accuracy, duration_ms, words_done, keystroke_log, xp_awarded)
  values (p_user, p_run ->> 'game', (p_run ->> 'seed')::bigint, (p_run ->> 'score')::integer,
          (p_run ->> 'won')::boolean, (p_run ->> 'wpm')::numeric, (p_run ->> 'accuracy')::numeric,
          (p_run ->> 'duration_ms')::integer, (p_run ->> 'words_done')::integer, p_run -> 'keystroke_log', greatest(p_xp, 0));

  update public.profiles set xp = xp + greatest(p_xp, 0) where id = p_user returning xp into v_xp;
  return jsonb_build_object('xp', v_xp, 'xp_awarded', greatest(p_xp, 0), 'previous_best', v_prev,
                            'is_best', v_prev is null or (p_run ->> 'score')::integer > v_prev);
end $$;

-- Best score per player for one game.
create or replace function public.game_leaderboard(p_game text, p_limit integer default 20)
returns table ("position" bigint, user_id uuid, username text, level integer, score integer, wpm numeric, won boolean, played_at timestamptz)
language sql stable set search_path = '' as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.score, g.wpm, g.won, g.created_at
    from public.game_runs g where g.game = p_game
    order by g.user_id, g.score desc, g.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc), b.user_id, p.username, p.level,
         b.score, b.wpm, b.won, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.record_game(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_game(uuid, jsonb, integer) to service_role;
grant execute on function public.game_leaderboard(text, integer) to anon, authenticated;
