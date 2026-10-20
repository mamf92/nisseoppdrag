begin;
create extension if not exists pgtap with schema extensions;

-- Fixture: two workplaces with a catalog and an active season covering today.
--   a = admin W1 (Grøtnissen), b = player W1, c = admin W2 (Fjøsnissen), d = signed in, no member.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@firma.no'),
  ('00000000-0000-0000-0000-00000000000c', 'c@annet.no'),
  ('00000000-0000-0000-0000-00000000000d', 'd@annet.no');
insert into public.workplaces (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firma AS', 'firma'),
  ('10000000-0000-0000-0000-000000000002', 'Annet AS', 'annet');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin', 'Grøtnissen'),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'admin', 'Fjøsnissen');
insert into public.seasons (workplace_id, name, starts_on, ends_on, distribution_hour, status)
select id, 'Jul', (date_trunc('week', now() at time zone 'Europe/Oslo') - interval '7 days')::date,
       (date_trunc('week', now() at time zone 'Europe/Oslo') + interval '55 days')::date, 0, 'active'
from public.workplaces;
insert into public.challenges (workplace_id, category, title_nb, title_en, points)
select w.id, c, c || ' nb ' || i, c || ' en ' || i, 10 * (1 + i % 3)
from public.workplaces w, unnest(enum_range(null::public.challenge_category)) c, generate_series(1, 4) i;

-- Acts as a signed-in user (role authenticated, JWT claims as PostgREST sets them).
create function pg_temp.act_as(p_user uuid, p_email text default null) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

select plan(26);

-- ---------- join through an invite ----------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select admin_create_invite('player', 30) as code \gset
select is(length(:'code'), 10, 'admin gets a 10 character invite code');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b@firma.no');
select is((select redeem_invite(:'code', '  Lyktenissen ', '{}') ->> 'workplace_id'),
          '10000000-0000-0000-0000-000000000001', 'the invite lands the player in the right workplace');
select throws_ok(format('select redeem_invite(%L, ''Dobbel'', ''{}'')', :'code'),
                 'P0001', 'already_member', 'a member cannot redeem again');
select is((select me() ->> 'nisse_name'), 'Lyktenissen', 'the nisse name is trimmed');

-- ---------- the week ----------
select is((ensure_my_week() ->> 'state'), 'open', 'the week is open');
select is(jsonb_array_length(ensure_my_week() -> 'slots'), 5, 'five slots');
select is((select count(distinct slot)::int from public.assignments), 5, 'one assignment per slot');
select is(
  (select array_agg(c.category::text order by a.slot)
   from public.assignments a join public.challenges c on c.id = a.challenge_id),
  array['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'],
  'slot n holds the n-th category');
select is(jsonb_array_length(ensure_my_week() -> 'slots'), 5, 'calling ensure_my_week again changes nothing');

select ensure_my_week() -> 'slots' -> 0 ->> 'assignment_id' as a1,
       ensure_my_week() -> 'slots' -> 1 ->> 'assignment_id' as a2,
       ensure_my_week() -> 'slots' -> 2 ->> 'assignment_id' as a3,
       ensure_my_week() -> 'slots' -> 3 ->> 'assignment_id' as a4,
       ensure_my_week() -> 'slots' -> 4 ->> 'assignment_id' as a5 \gset

-- ---------- complete ----------
select is((complete_assignment(:'a1'::uuid) ->> 'points')::int, (select points::int from public.challenges c join public.assignments a on a.challenge_id = c.id where a.id = :'a1'::uuid),
          'completing pays the challenge points');
select throws_ok(format('select complete_assignment(%L)', :'a1'), 'P0001', 'not_open', 'a completed slot cannot be completed again');
select is((select count(*)::int from public.points_ledger), 1, 'one ledger row');

-- ---------- skip: one per week ----------
select lives_ok(format('select skip_assignment(%L)', :'a2'), 'skip works once');
select throws_ok(format('select skip_assignment(%L)', :'a4'), 'P0001', 'skip_used', 'a second skip is refused');
select is((ensure_my_week() ->> 'skip_left')::boolean, false, 'skip_left turns false');

-- ---------- reroll: one per week, same category ----------
select reroll_assignment(:'a3'::uuid) ->> 'assignment_id' as a3new \gset
select is(
  (select c.category::text from public.assignments a join public.challenges c on c.id = a.challenge_id where a.id = :'a3new'::uuid),
  'learning', 'a reroll stays in the category');
select is((select slot::int from public.assignments where id = :'a3new'::uuid), 3, 'the replacement takes the same slot');
select throws_ok(format('select reroll_assignment(%L)', :'a4'), 'P0001', 'reroll_used', 'a second reroll is refused');
select is((select status::text from public.assignments where id = :'a4'::uuid), 'open',
          'the refused reroll left the slot untouched');
select is(jsonb_array_length(ensure_my_week() -> 'slots'), 5, 'still five live slots after skip and reroll');

-- ---------- ledger and leaderboard ----------
select is((select count(*)::int from public.points_ledger), 1, 'skip and reroll pay nothing');
select is((select points::int from leaderboard('season') where nisse_name = 'Lyktenissen'),
          (select sum(delta)::int from public.points_ledger), 'the leaderboard shows the ledger total');
select is((select count(*)::int from leaderboard('season')), 2, 'the leaderboard lists the workplace only');

-- ---------- clients cannot write ----------
select throws_ok('insert into public.points_ledger (member_id, season_id, week_start, reason, delta) select member_id, season_id, week_start, ''challenge'', 500 from public.assignments limit 1',
                 '42501', null, 'no direct ledger insert');
select throws_ok('update public.assignments set status = ''completed''', '42501', null, 'no direct assignment update');
select throws_ok('select admin_stats()', 'P0001', 'forbidden', 'a player cannot read admin stats');

select * from finish();
rollback;
