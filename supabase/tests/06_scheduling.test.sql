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
select id, 'Jul', '2026-10-12', '2026-12-06', 6, 'active' from public.workplaces;
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

-- A controllable clock: private.clock() reads this table while it exists (rolled back with the test).
create table private.test_clock (at timestamptz);
insert into private.test_clock values (null);
create function pg_temp.clock_utc(p timestamptz) returns void language sql as $$ update private.test_clock set at = p $$;
create function pg_temp.clock_oslo(p text) returns void language sql as
  $$ update private.test_clock set at = p::timestamp at time zone 'Europe/Oslo' $$;

insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Lyktenissen');

select plan(27);

-- ---------- Monday distribution waits for 06:00 Oslo ----------
select pg_temp.clock_oslo('2026-10-12 05:59');
select private.hourly_tick();
select is((select count(*)::int from public.assignments), 0, 'nothing is distributed before 06:00 Oslo');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(ensure_my_week() ->> 'state', 'no_active_week', 'ensure_my_week agrees: the week is not open yet');
reset role;

select pg_temp.clock_oslo('2026-10-12 06:00');
select private.hourly_tick();
select is((select count(*)::int from public.assignments), 15, 'three members get five slots at 06:00');
select private.hourly_tick();
select private.hourly_tick();
select is((select count(*)::int from public.assignments), 15, 'a repeated tick changes nothing');
select is((select count(*)::int from public.job_runs where job = 'hourly_tick' and ok is not true), 0, 'every tick finished ok');

-- ---------- late joiner ----------
select pg_temp.clock_oslo('2026-10-14 12:00');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'player', 'Sentnissen');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is(jsonb_array_length(ensure_my_week() -> 'slots'), 5, 'a late joiner gets a full week from ensure_my_week');
reset role;
select private.hourly_tick();
select is((select count(*)::int from public.assignments where member_id = '20000000-0000-0000-0000-00000000000d'), 5, 'the tick does not duplicate the late joiner''s slots');

-- ---------- week one: b completes all five, a three ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select complete_assignment(id) from public.assignments where status = 'open' and week_start = '2026-10-12' order by slot;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select complete_assignment(id) from public.assignments where status = 'open' and week_start = '2026-10-12' order by slot limit 3;
reset role;
select is((select count(*)::int from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b' and reason = 'full_week'), 0, 'no weekly bonus before the week closes');

select pg_temp.clock_oslo('2026-10-19 06:00');
select private.hourly_tick();
select is((select array_agg(delta) from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b' and reason = 'full_week'), array[25], 'a full week pays 25, once');
select is((select count(*)::int from public.points_ledger where reason = 'full_week' and member_id = '20000000-0000-0000-0000-00000000000a'), 0, 'three of five is no full week');
select is((select count(*)::int from public.points_ledger where reason = 'streak'), 0, 'no streak bonus after the first week');
select private.close_week('10000000-0000-0000-0000-000000000001', '2026-10-12');
select private.hourly_tick();
select is((select count(*)::int from public.points_ledger where reason = 'full_week'), 1, 'closing again pays nothing twice');
select is((select count(*)::int from public.week_closures where workplace_id = '10000000-0000-0000-0000-000000000001'), 1, 'one closure per workplace and week');

-- ---------- week two: same again, now the streak counts ----------
select pg_temp.clock_oslo('2026-10-21 12:00');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select complete_assignment(id) from public.assignments where status = 'open' and week_start = '2026-10-19' order by slot;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select complete_assignment(id) from public.assignments where status = 'open' and week_start = '2026-10-19' order by slot limit 3;
reset role;

-- DST ended on Sunday 25 October: Monday 06:00 Oslo is 05:00 UTC
select pg_temp.clock_utc('2026-10-26 04:59:00+00');
select private.hourly_tick();
select is((select count(*)::int from public.assignments where week_start = '2026-10-26'), 0, 'after DST ends, 04:59 UTC is still before 06:00 Oslo');
select pg_temp.clock_utc('2026-10-26 05:00:00+00');
select private.hourly_tick();
select is((select count(*)::int from public.assignments where week_start = '2026-10-26'), 20, 'and 05:00 UTC distributes to all four members');

select is((select array_agg(delta order by week_start) from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b' and reason = 'full_week'), array[25, 25], 'week two paid its full-week bonus');
select is((select array_agg(delta) from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b' and reason = 'streak'), array[5], 'two weeks in a row pay streak +5');
select is((select array_agg(delta) from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000a' and reason = 'streak'), array[5], 'three completions are enough for the streak');
select private.hourly_tick();
select is((select count(*)::int from public.points_ledger where reason = 'streak'), 2, 'the streak is paid once per member and week');

-- ---------- the achievements fire along the way ----------
select is((select array_agg(achievement_code order by achievement_code) from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b' and reason = 'achievement'),
          array['first_spoon', 'full_barn'], 'bonus points for first_spoon and full_barn are paid once');
select is((select count(*)::int from public.member_achievements where member_id = '20000000-0000-0000-0000-00000000000b'), 2, 'and the badges are stored');

-- ---------- season end, retention ----------
select pg_temp.clock_oslo('2026-12-07 06:00');
select private.hourly_tick();
select is((select status::text from public.seasons where workplace_id = '10000000-0000-0000-0000-000000000001'), 'finished', 'the season finishes after its last week');
select is((select count(*)::int from public.week_closures where workplace_id = '10000000-0000-0000-0000-000000000001'), 8, 'all eight weeks are closed');
select is((select count(*)::int from public.assignments where week_start > '2026-11-30'), 0, 'nothing is distributed after the season');

insert into public.invites (workplace_id, code_hash, role, expires_at) values
  ('10000000-0000-0000-0000-000000000001', extensions.digest('STALE', 'sha256'), 'player', '2026-12-01');
select pg_temp.clock_oslo('2027-03-10 03:00');
select private.daily_housekeeping();
select is((select count(*)::int from public.invites), 0, 'expired invites are removed');
select is((select count(*)::int from public.seasons), 0, 'seasons are deleted 90 days after they end');
select is((select count(*)::int from public.points_ledger) + (select count(*)::int from public.assignments), 0, 'with their assignments and points');

select * from finish();
rollback;
