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

-- Summer time starts on Sunday 28 March 2027: Monday 06:00 Oslo is 04:00 UTC.
update public.seasons set starts_on = '2027-03-22', ends_on = '2027-04-04'
where workplace_id = '10000000-0000-0000-0000-000000000002';

select plan(4);

select pg_temp.clock_utc('2027-03-29 03:59:00+00');
select private.hourly_tick();
select is((select count(*)::int from public.assignments where week_start = '2027-03-29'), 0, '03:59 UTC is 05:59 Oslo time: nothing yet');
select pg_temp.clock_utc('2027-03-29 04:00:00+00');
select private.hourly_tick();
select is((select count(*)::int from public.assignments where week_start = '2027-03-29'), 5, '04:00 UTC is 06:00 Oslo time: distribution');
select is(private.week_of('Europe/Oslo'), '2027-03-29'::date, 'the local week starts on the Monday');
select pg_temp.clock_utc('2027-03-28 22:30:00+00');
select is(private.week_of('Europe/Oslo'), '2027-03-29'::date, 'Sunday 22:30 UTC is already Monday in Oslo, so the previous week is over');

select * from finish();
rollback;
