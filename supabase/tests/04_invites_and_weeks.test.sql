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

insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Lyktenissen');
insert into public.invites (workplace_id, code_hash, role, expires_at, max_uses, uses) values
  ('10000000-0000-0000-0000-000000000002', extensions.digest('GOODCODE', 'sha256'), 'player', now() + interval '1 day', 2, 0),
  ('10000000-0000-0000-0000-000000000002', extensions.digest('OLDCODE', 'sha256'), 'player', now() - interval '1 second', 5, 0),
  ('10000000-0000-0000-0000-000000000002', extensions.digest('FULLCODE', 'sha256'), 'player', now() + interval '1 day', 1, 1),
  ('10000000-0000-0000-0000-000000000001', extensions.digest('FIRMACODE', 'sha256'), 'player', now() + interval '1 day', 5, 0);
update public.workplaces set allowed_email_domains = '{firma.no}' where slug = 'firma';
-- a user from the last (open) week is closed once this week runs
insert into public.assignments (id, member_id, season_id, week_start, slot, challenge_id)
select '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000b', s.id,
       (date_trunc('week', now() at time zone 'Europe/Oslo') - interval '7 days')::date, 1, c.id
from public.seasons s join public.challenges c on c.workplace_id = s.workplace_id and c.category = 'social'
where s.workplace_id = '10000000-0000-0000-0000-000000000001' limit 1;

select plan(15);

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'd@annet.no');
select throws_ok('select redeem_invite(''nonsense'', ''Dobbel'', ''{}'')', 'P0001', 'invite_invalid', 'an unknown code is refused');
select throws_ok('select redeem_invite(''OLDCODE'', ''Dobbel'', ''{}'')', 'P0001', 'invite_invalid', 'an expired code is refused');
select throws_ok('select redeem_invite(''FULLCODE'', ''Dobbel'', ''{}'')', 'P0001', 'invite_invalid', 'a code with no uses left is refused');
select throws_ok('select redeem_invite(''FIRMACODE'', ''Dobbel'', ''{}'')', 'P0001', 'domain_not_allowed', 'the e-mail domain gate holds');
select throws_ok('select redeem_invite(''GOODCODE'', ''Fjøsnissen'', ''{}'')', 'P0001', 'name_taken', 'a taken nisse name is refused');
select is((select redeem_invite('goodcode', 'Nyttnissen', '{}') ->> 'workplace_id'), '10000000-0000-0000-0000-000000000002', 'codes are case-insensitive');
reset role;
select is((select uses::int from public.invites where code_hash = extensions.digest('GOODCODE', 'sha256')), 1, 'the code counts a use');
select is((select count(*)::int from public.members where nisse_name = 'Nyttnissen' and role = 'player'), 1, 'the new member is a player');

-- invite creation is admin only and stores a hash
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok('select admin_create_invite(''player'', 30)', 'P0001', 'forbidden', 'a player cannot create invites');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok('select admin_create_invite(''player'', 0)', 'P0001', 'invalid_input', 'the expiry is bounded');
select throws_ok('select admin_create_invite(''player'', 91)', 'P0001', 'invalid_input', 'the expiry is bounded above');
reset role;
select is((select count(*)::int from public.invites where created_by = '00000000-0000-0000-0000-00000000000a'), 0, 'a refused call stores no invite');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select min(length(public.admin_create_invite('player', 1))) from generate_series(1, 300)), 10,
          'every invite code is exactly ten characters');
reset role;

-- the week window
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok('select complete_assignment(''30000000-0000-0000-0000-000000000001'')', 'P0001', 'week_closed', 'completing outside the open week fails');
select throws_ok('select skip_assignment(''30000000-0000-0000-0000-000000000001'')', 'P0001', 'week_closed', 'skipping outside the open week fails');

select * from finish();
rollback;
