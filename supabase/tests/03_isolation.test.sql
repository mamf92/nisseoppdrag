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

-- Extra fixture: player b in W1 with a week of assignments and points; a secret and a public badge.
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Lyktenissen');
insert into public.achievements (code, name_nb, name_en, description_nb, description_en, icon, bonus_points, rule, is_secret) values
  ('open_badge', 'Åpen', 'Open', 'x', 'x', 'star', 0, '{"type":"total_completed","n":1}', false),
  ('secret_badge', 'Hemmelig', 'Secret', 'x', 'x', 'star', 0, '{"type":"total_completed","n":99}', true);

select plan(24);

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select ensure_my_week() -> 'slots' -> 0 ->> 'assignment_id' as b1 \gset
select complete_assignment(:'b1'::uuid) is not null as done \gset

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select ensure_my_week() is not null as c_week \gset

-- ---------- a player sees only their own rows ----------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.assignments where member_id <> private.my_member_id()), 0, 'b sees no foreign assignments');
select is((select count(*)::int from public.points_ledger where reason = 'challenge'), 1, 'b sees only the own ledger');
select is((select count(*)::int from public.points_ledger where member_id <> private.my_member_id()), 0, 'b sees no foreign ledger rows');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.assignments), 0, 'an admin does not see the players'' assignments either');
select is((select count(*)::int from public.points_ledger), 0, 'an admin does not see the players'' ledger');
select is((select count(*)::int from public.members), 2, 'an admin sees the colleagues of the own workplace');

-- ---------- tenants are sealed ----------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select array_agg(nisse_name) from public.members), array['Fjøsnissen'], 'c sees only the own workplace members');
select is((select count(*)::int from public.assignments), 5, 'c sees only the own assignments');
select is((select count(*)::int from public.workplaces), 1, 'c sees only the own workplace');
select is((select count(*)::int from public.challenges where workplace_id = '10000000-0000-0000-0000-000000000001'), 0, 'c cannot read the other catalog');
select throws_ok(format('select complete_assignment(%L)', :'b1'), 'P0001', 'not_found', 'c cannot complete b''s assignment');
select is((select count(*)::int from leaderboard('season') where name = 'Lyktenissen'), 0, 'the leaderboard never crosses workplaces');
select lives_ok('update public.challenges set points = 50 where workplace_id = ''10000000-0000-0000-0000-000000000001''', 'a foreign catalog update is accepted by SQL ...');
reset role;
select is((select count(*)::int from public.challenges where points = 50), 0, '... but touched no rows');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok('insert into public.challenges (workplace_id, category, title_nb, title_en) values (''10000000-0000-0000-0000-000000000001'', ''social'', ''abc'', ''abc'')',
                 '42501', null, 'c cannot insert into the foreign catalog');

-- ---------- admin cannot touch another workplace ----------
select throws_ok('select admin_set_role(''20000000-0000-0000-0000-00000000000b'', ''admin'')', 'P0001', 'not_found', 'cannot change a foreign role');
select throws_ok('select admin_remove_member(''20000000-0000-0000-0000-00000000000b'')', 'P0001', 'not_found', 'cannot remove a foreign member');
select throws_ok('select admin_adjust_points(''20000000-0000-0000-0000-00000000000b'', 10, ''x'')', 'P0001', 'not_found', 'cannot adjust foreign points');

-- ---------- last admin ----------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok('select admin_set_role(''20000000-0000-0000-0000-00000000000a'', ''player'')', 'P0001', 'last_admin', 'the last admin cannot be demoted');
select lives_ok('select admin_set_role(''20000000-0000-0000-0000-00000000000b'', ''admin'')', 'a player can be promoted');
select lives_ok('select admin_set_role(''20000000-0000-0000-0000-00000000000a'', ''player'')', 'with a second admin the first may step down');

-- ---------- secret achievements ----------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select array_agg(code order by code) from public.achievements where code in ('open_badge', 'secret_badge')), array['open_badge'], 'secret badges are hidden until unlocked');
reset role;
insert into public.member_achievements (member_id, achievement_code) values ('20000000-0000-0000-0000-00000000000b', 'secret_badge');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select array_agg(code order by code) from public.achievements where code in ('open_badge', 'secret_badge')), array['open_badge', 'secret_badge'], 'an unlocked secret badge shows');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.member_achievements), 0, 'badges of another workplace are not visible');

select * from finish();
rollback;
