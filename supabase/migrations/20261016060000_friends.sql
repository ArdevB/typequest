-- TypeQuest: friends and friend challenges.
--
-- Friendships are managed by the players themselves through SECURITY DEFINER
-- functions that act as auth.uid() (no direct table writes). Friend
-- challenges hold a typing test both players take with the same seed; runs
-- are replayed and checked by the server, which writes them with the service role.

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
-- One row per pair, whichever direction it was sent in.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee, status);

alter table public.friendships enable row level security;
drop policy if exists "See your own friendships" on public.friendships;
create policy "See your own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));
revoke insert, update, delete on public.friendships from anon, authenticated;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;

-- Send a request by username. If they already asked you, this accepts it.
create or replace function public.send_friend_request(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_them uuid;
  v_row public.friendships;
begin
  if v_me is null then return jsonb_build_object('status', 'signed_out'); end if;
  select p.id into v_them from public.profiles p where lower(p.username) = lower(trim(p_username));
  if v_them is null then return jsonb_build_object('status', 'not_found'); end if;
  if v_them = v_me then return jsonb_build_object('status', 'self'); end if;

  select * into v_row from public.friendships f
  where least(f.requester, f.addressee) = least(v_me, v_them) and greatest(f.requester, f.addressee) = greatest(v_me, v_them);

  if v_row.id is null then
    insert into public.friendships (requester, addressee) values (v_me, v_them);
    return jsonb_build_object('status', 'sent');
  elsif v_row.status = 'accepted' then
    return jsonb_build_object('status', 'already_friends');
  elsif v_row.requester = v_me then
    return jsonb_build_object('status', 'already_sent');
  else
    update public.friendships set status = 'accepted', responded_at = now() where id = v_row.id;
    return jsonb_build_object('status', 'accepted');
  end if;
end $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where id = p_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = auth.uid() and status = 'pending';
  end if;
  return found;
end $$;

-- Unfriend, or cancel a request you sent.
create or replace function public.remove_friend(p_other uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships f
  where least(f.requester, f.addressee) = least(auth.uid(), p_other)
    and greatest(f.requester, f.addressee) = greatest(auth.uid(), p_other);
  return found;
end $$;

-- Your friends and requests, with each player's level, rank, rating and streak.
create or replace function public.my_friends()
returns table (friendship_id uuid, user_id uuid, username text, level integer, xp integer, rank text,
               rating_wpm numeric, streak integer, best_wpm numeric, relation text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id,
         p.id, p.username, p.level, p.xp, p.rank, p.rating_wpm, p.streak,
         coalesce((select max(r.wpm) from public.runs r where r.user_id = p.id), 0),
         case when f.status = 'accepted' then 'friend'
              when f.addressee = auth.uid() then 'incoming'
              else 'outgoing' end,
         coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.status = 'accepted' desc, p.level desc, p.xp desc;
$$;

-- Relationship with one player (for profile pages): none / friend / incoming / outgoing.
create or replace function public.friend_status(p_other uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('relation',
              case when f.status = 'accepted' then 'friend'
                   when f.addressee = auth.uid() then 'incoming' else 'outgoing' end,
              'id', f.id)
     from public.friendships f
     where least(f.requester, f.addressee) = least(auth.uid(), p_other)
       and greatest(f.requester, f.addressee) = greatest(auth.uid(), p_other)),
    jsonb_build_object('relation', 'none'));
$$;

-- ---------------------------------------------------------------------------
-- Friend challenges: same seed and settings for both; higher WPM wins
-- (accuracy breaks ties).
-- ---------------------------------------------------------------------------
create table if not exists public.friend_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.profiles (id) on delete cascade,
  opponent uuid not null references public.profiles (id) on delete cascade,
  settings jsonb not null,
  seed bigint not null,
  challenger_wpm numeric(6, 2) not null,
  challenger_accuracy numeric(5, 2) not null,
  challenger_log jsonb not null,
  opponent_wpm numeric(6, 2),
  opponent_accuracy numeric(5, 2),
  opponent_log jsonb,
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  winner uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  check (challenger <> opponent)
);
create index if not exists friend_challenges_opponent_idx on public.friend_challenges (opponent, status);
create index if not exists friend_challenges_challenger_idx on public.friend_challenges (challenger, created_at desc);

alter table public.friend_challenges enable row level security;
drop policy if exists "See your own challenges" on public.friend_challenges;
create policy "See your own challenges" on public.friend_challenges
  for select to authenticated using ((select auth.uid()) in (challenger, opponent));
revoke insert, update, delete on public.friend_challenges from anon, authenticated;

-- Server only (after replaying the challenger's run).
create or replace function public.create_friend_challenge(p_user uuid, p_opponent uuid, p_settings jsonb, p_seed bigint,
                                                          p_wpm numeric, p_accuracy numeric, p_log jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_open integer;
begin
  if not public.are_friends(p_user, p_opponent) then return jsonb_build_object('error', 'not_friends'); end if;
  select count(*) into v_open from public.friend_challenges
  where challenger = p_user and opponent = p_opponent and status = 'open' and expires_at > now();
  if v_open >= 3 then return jsonb_build_object('error', 'too_many_open'); end if;
  insert into public.friend_challenges (challenger, opponent, settings, seed, challenger_wpm, challenger_accuracy, challenger_log)
  values (p_user, p_opponent, p_settings, p_seed, p_wpm, p_accuracy, p_log)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- Server only (after replaying the opponent's run with the challenge's seed). Winner gets XP.
create or replace function public.complete_friend_challenge(p_user uuid, p_id uuid, p_wpm numeric, p_accuracy numeric,
                                                            p_log jsonb, p_win_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.friend_challenges;
  v_winner uuid;
begin
  select * into c from public.friend_challenges where id = p_id for update;
  if c.id is null or c.opponent <> p_user then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'open' then return jsonb_build_object('error', 'closed'); end if;
  if c.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;

  v_winner := case
    when p_wpm > c.challenger_wpm then c.opponent
    when p_wpm < c.challenger_wpm then c.challenger
    when p_accuracy > c.challenger_accuracy then c.opponent
    when p_accuracy < c.challenger_accuracy then c.challenger
    else null end;

  update public.friend_challenges
  set opponent_wpm = p_wpm, opponent_accuracy = p_accuracy, opponent_log = p_log,
      status = 'done', winner = v_winner, completed_at = now()
  where id = p_id;

  if v_winner is not null then
    update public.profiles set xp = xp + greatest(p_win_xp, 0) where id = v_winner;
  end if;
  return jsonb_build_object('winner', v_winner, 'challenger_wpm', c.challenger_wpm, 'challenger_accuracy', c.challenger_accuracy,
                            'xp_awarded', case when v_winner = p_user then greatest(p_win_xp, 0) else 0 end);
end $$;

create or replace function public.decline_friend_challenge(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_challenges set status = 'declined', completed_at = now()
  where id = p_id and opponent = auth.uid() and status = 'open';
  return found;
end $$;

-- Challenges you're part of, newest first, with both players' names and levels.
create or replace function public.my_friend_challenges(p_limit integer default 30)
returns table (id uuid, challenger uuid, challenger_name text, challenger_level integer,
               opponent uuid, opponent_name text, opponent_level integer, settings jsonb, seed bigint,
               challenger_wpm numeric, challenger_accuracy numeric, opponent_wpm numeric, opponent_accuracy numeric,
               status text, winner uuid, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.challenger, a.username, a.level, c.opponent, b.username, b.level, c.settings, c.seed,
         c.challenger_wpm, c.challenger_accuracy, c.opponent_wpm, c.opponent_accuracy,
         case when c.status = 'open' and c.expires_at < now() then 'expired' else c.status end,
         c.winner, c.created_at, c.expires_at
  from public.friend_challenges c
  join public.profiles a on a.id = c.challenger
  join public.profiles b on b.id = c.opponent
  where auth.uid() in (c.challenger, c.opponent)
  order by (c.status = 'open' and c.opponent = auth.uid() and c.expires_at > now()) desc, c.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.create_friend_challenge(uuid, uuid, jsonb, bigint, numeric, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_friend_challenge(uuid, uuid, numeric, numeric, jsonb, integer) from public, anon, authenticated;
grant execute on function public.create_friend_challenge(uuid, uuid, jsonb, bigint, numeric, numeric, jsonb) to service_role;
grant execute on function public.complete_friend_challenge(uuid, uuid, numeric, numeric, jsonb, integer) to service_role;
revoke execute on function public.are_friends(uuid, uuid) from authenticated;
grant execute on function public.are_friends(uuid, uuid) to service_role;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friends() from public, anon;
revoke execute on function public.friend_status(uuid) from public, anon;
revoke execute on function public.decline_friend_challenge(uuid) from public, anon;
revoke execute on function public.my_friend_challenges(integer) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.friend_status(uuid) to authenticated;
grant execute on function public.decline_friend_challenge(uuid) to authenticated;
grant execute on function public.my_friend_challenges(integer) to authenticated;
