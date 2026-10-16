-- Behaviour tests for friends and friend challenges.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@example.com', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@example.com', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@example.com', '{"username":"carol"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select public.send_friend_request('BOB') ->> 'status' as alice_to_bob;
select public.send_friend_request('bob') ->> 'status' as again;
select public.send_friend_request('alice') ->> 'status' as self;
select public.send_friend_request('nobody_here') ->> 'status' as missing;
select relation from public.my_friends();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select username, relation from public.my_friends();
select public.respond_friend_request(f.id, true) as bob_accepts from public.friendships f where f.addressee = auth.uid();
select username, relation, level from public.my_friends();
select public.friend_status('00000000-0000-0000-0000-0000000000f1') ->> 'relation' as bob_sees_alice;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f3', false);
select count(*) as carol_sees_rows from public.friendships;
reset role;

-- Challenges (server side).
set role service_role;
select public.create_friend_challenge('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f3',
  '{"mode":{"kind":"time","seconds":30}}', 1, 60, 95, '[]') ->> 'error' as not_friends;
select (public.create_friend_challenge('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
  '{"mode":{"kind":"time","seconds":30}}', 42, 60, 95, '[]') ->> 'id') is not null as created;
select public.complete_friend_challenge('00000000-0000-0000-0000-0000000000f1', c.id, 70, 99, '[]', 30) ->> 'error' as wrong_player
  from public.friend_challenges c limit 1;
select public.complete_friend_challenge('00000000-0000-0000-0000-0000000000f2', c.id, 72.5, 97, '[]', 30) - 'challenger_accuracy' as bob_plays
  from public.friend_challenges c limit 1;
select public.complete_friend_challenge('00000000-0000-0000-0000-0000000000f2', c.id, 80, 99, '[]', 30) ->> 'error' as twice
  from public.friend_challenges c limit 1;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select challenger_name, opponent_name, status, winner = opponent as bob_won from public.my_friend_challenges();
select public.remove_friend('00000000-0000-0000-0000-0000000000f2') as unfriended;
select count(*) as friends_left from public.my_friends();
\set ON_ERROR_STOP 0
insert into public.friendships (requester, addressee) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f3');
select public.create_friend_challenge('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', '{}', 1, 300, 100, '[]');
select public.are_friends('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
reset role;
select xp from public.profiles where username = 'bob';
