begin;
create extension if not exists pgtap with schema extensions;

-- Fixture: one workplace with an admin (nisse name Grøtnissen) and a signed-in user without a member.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@firma.no'),
  ('00000000-0000-0000-0000-00000000000c', 'c@firma.no');
insert into public.workplaces (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firma AS', 'firma');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin', 'Grøtnissen');
insert into public.seasons (workplace_id, name, starts_on, ends_on, distribution_hour, status)
select id, 'Jul', (date_trunc('week', now() at time zone 'Europe/Oslo') - interval '7 days')::date,
       (date_trunc('week', now() at time zone 'Europe/Oslo') + interval '55 days')::date, 0, 'active'
from public.workplaces;
insert into public.invites (workplace_id, code_hash, role, expires_at, max_uses) values
  ('10000000-0000-0000-0000-000000000001', extensions.digest('NAMES', 'sha256'), 'player', now() + interval '1 day', 5);

create function pg_temp.act_as(p_user uuid, p_email text default null) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select plan(17);

-- joining in Låven stores a farmer name and no nisse name
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b@firma.no');
select is((select redeem_invite('names', 'laaven', '  Kari Haugen ') ->> 'workplace_id'),
          '10000000-0000-0000-0000-000000000001', 'a player can join in Låven');
select is((select me() ->> 'story'), 'laaven', 'me() reports the story');
select is((select me() ->> 'name'), 'Kari Haugen', 'the shown name is the farmer name, trimmed');
select is((select me() ->> 'nisse_name'), null, 'there is no nisse name yet');
select is((select me() ? 'avatar'), false, 'me() has no avatar');

-- a colleague sees the farmer name
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select farmer_name from public.members where story = 'laaven'), 'Kari Haugen', 'colleagues can read the farmer name');
select is((select name from leaderboard('season') where member_id = '20000000-0000-0000-0000-00000000000a'),
          'Grøtnissen', 'a Gården player is listed by the nisse name');
select is((select count(*)::int from leaderboard('season') where name = 'Kari Haugen'), 1,
          'a Låven player is listed by the farmer name');

-- switching story
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b@firma.no');
select throws_ok($$select update_profile('gaarden')$$, 'P0001', 'name_required',
                 'switching to a story with no name asks for one');
select throws_ok($$select update_profile('gaarden', 'Grøtnissen')$$, 'P0001', 'name_taken',
                 'a nisse name taken by a colleague is refused');
select lives_ok($$select update_profile('gaarden', 'Lyktenissen')$$, 'switching with a new nisse name works');
select is((select me() ->> 'name'), 'Lyktenissen', 'the shown name follows the story');
select lives_ok($$select update_profile('laaven')$$, 'switching back needs no name');
select is((select me() ->> 'name'), 'Kari Haugen', 'the farmer name was kept');
select throws_ok($$select update_profile('laaven', '<b>')$$, 'P0001', 'invalid_input',
                 'markup in a name is refused');

-- two players cannot share a farmer name
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'c@firma.no');
select throws_ok($$select redeem_invite('names', 'laaven', 'Kari Haugen')$$, 'P0001', 'name_taken',
                 'a farmer name taken by a colleague is refused');

-- ... and a nisse name cannot equal a colleague's farmer name
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'a@firma.no');
select throws_ok($$select update_profile('gaarden', 'kari haugen')$$, 'P0001', 'name_taken',
                 'a nisse name equal to a colleague''s farmer name is refused');

select * from finish();
rollback;
