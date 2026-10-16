-- TypeQuest Phase 6: the Weekly Boss.
-- Weekly Boss fights are stored as game runs (game = 'weekly-boss'). Everyone
-- fights with the same seed all week; the server only accepts this week's seed
-- (or last week's, for a fight that started before the Monday reset).

alter table public.game_runs drop constraint if exists game_runs_game_check;
alter table public.game_runs add constraint game_runs_game_check
  check (game in ('falling-words', 'boss-battle', 'racing', 'stickman-duel', 'weekly-boss'));

-- "Best" for a Weekly Boss means best against this week's boss.
create or replace function public.record_game(p_user uuid, p_run jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prev integer;
  v_xp integer;
begin
  select max(g.score) into v_prev from public.game_runs g
  where g.user_id = p_user and g.game = p_run ->> 'game'
    and (p_run ->> 'game' <> 'weekly-boss' or g.seed = (p_run ->> 'seed')::bigint);

  insert into public.game_runs (user_id, game, seed, score, won, wpm, accuracy, duration_ms, words_done, keystroke_log, xp_awarded)
  values (p_user, p_run ->> 'game', (p_run ->> 'seed')::bigint, (p_run ->> 'score')::integer,
          (p_run ->> 'won')::boolean, (p_run ->> 'wpm')::numeric, (p_run ->> 'accuracy')::numeric,
          (p_run ->> 'duration_ms')::integer, (p_run ->> 'words_done')::integer, p_run -> 'keystroke_log', greatest(p_xp, 0));

  update public.profiles set xp = xp + greatest(p_xp, 0) where id = p_user returning xp into v_xp;
  return jsonb_build_object('xp', v_xp, 'xp_awarded', greatest(p_xp, 0), 'previous_best', v_prev,
                            'is_best', v_prev is null or (p_run ->> 'score')::integer > v_prev);
end $$;

revoke execute on function public.record_game(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_game(uuid, jsonb, integer) to service_role;

create index if not exists game_runs_weekly_idx on public.game_runs (seed, score desc) where game = 'weekly-boss';

-- Best score per player for one week's boss (identified by its seed).
create or replace function public.weekly_boss_leaderboard(p_seed bigint, p_limit integer default 20)
returns table ("position" bigint, user_id uuid, username text, level integer, score integer, wpm numeric, won boolean, played_at timestamptz)
language sql stable set search_path = '' as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.score, g.wpm, g.won, g.created_at
    from public.game_runs g where g.game = 'weekly-boss' and g.seed = p_seed
    order by g.user_id, g.score desc, g.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc), b.user_id, p.username, p.level,
         b.score, b.wpm, b.won, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

grant execute on function public.weekly_boss_leaderboard(bigint, integer) to anon, authenticated;
