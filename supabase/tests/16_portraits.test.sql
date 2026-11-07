begin;
create extension if not exists pgtap with schema extensions;

-- Fixture: two workplaces, a player in each, and a signed-in user without a member.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@annet.no'),
  ('00000000-0000-0000-0000-00000000000c', 'c@firma.no');
insert into public.workplaces (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firma AS', 'firma'),
  ('10000000-0000-0000-0000-000000000002', 'Annet AS', 'annet');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'player', 'Grøtnissen'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'player', 'Snønissen');
insert into public.seasons (workplace_id, name, starts_on, ends_on, distribution_hour, status)
select id, 'Jul', (date_trunc('week', now() at time zone 'Europe/Oslo') - interval '7 days')::date,
       (date_trunc('week', now() at time zone 'Europe/Oslo') + interval '55 days')::date, 0, 'active'
from public.workplaces;

create function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select plan(12);

select is((select count(*)::int from public.portraits), 21, 'the set has twenty-one painted portraits');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select me() ->> 'portrait'), null, 'a new player has no chosen portrait');
select lives_ok($$select set_portrait('fjoskatten')$$, 'a player can pick a portrait');
select is((select me() ->> 'portrait'), 'fjoskatten', 'me() returns the portrait');
select is((select portrait from leaderboard('season')), 'fjoskatten', 'the leaderboard returns the portrait');
select throws_ok($$select set_portrait('../../evil')$$, 'P0001', 'invalid_input', 'an unknown id is refused');
select throws_ok($$select set_portrait('nissefar-2')$$, 'P0001', 'invalid_input', 'an id outside the set is refused');
select is((select me() ->> 'portrait'), 'fjoskatten', 'a refused id leaves the choice as it was');
select lives_ok($$select set_portrait(null)$$, 'a player can go back to the drawn nisse');

-- the portrait is only written through set_portrait, and the set cannot be read or changed
select throws_ok($$update public.members set portrait = 'musa'$$, '42501', null,
                 'players cannot write the portrait column directly');
select throws_ok($$select * from public.portraits$$, '42501', null, 'clients cannot read the portrait table');

-- a user with no membership cannot set one
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$select set_portrait('musa')$$, 'P0001', 'not_a_member', 'someone outside a game cannot set a portrait');

select * from finish();
rollback;
