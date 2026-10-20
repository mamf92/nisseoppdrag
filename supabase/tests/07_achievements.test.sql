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

-- Players for the rule tests: each gets hand-made completed assignments, then we evaluate.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'p' || i || '@firma.no' from generate_series(1, 6) i;
insert into public.members (id, workplace_id, user_id, nisse_name)
select ('20000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, '10000000-0000-0000-0000-000000000001',
       ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'Nisse' || i from generate_series(1, 6) i;

create function pg_temp.mid(i int) returns uuid language sql as
  $$ select ('20000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid $$;
create function pg_temp.season() returns uuid language sql as
  $$ select id from public.seasons where workplace_id = '10000000-0000-0000-0000-000000000001' $$;
-- one completed assignment for member i in the given week and slot (slot n = category n)
create function pg_temp.done(i int, p_week date, p_slot int, p_when timestamptz default null, p_replaces uuid default null, p_offset int default 0)
returns uuid language sql as $$
  insert into public.assignments (member_id, season_id, week_start, slot, challenge_id, status, completed_at, replaces_id, points_awarded)
  select pg_temp.mid(i), pg_temp.season(), p_week, p_slot, c.id, 'completed',
         coalesce(p_when, ((p_week + 2)::timestamp + time '12:00') at time zone 'Europe/Oslo'), p_replaces, 10
  from public.challenges c
  where c.workplace_id = '10000000-0000-0000-0000-000000000001'
    and c.category = (enum_range(null::public.challenge_category))[p_slot]
  order by c.title_nb limit 1 offset p_offset
  returning id $$;

select plan(18);

-- the clock sits in the third week of the season
select pg_temp.clock_oslo('2026-10-28 12:00');

-- 1: one completion -> first_spoon only
select pg_temp.done(1, '2026-10-26', 1);
select is(private.evaluate_achievements(pg_temp.mid(1), pg_temp.season()), array['first_spoon'], 'total_completed: the first mission');

-- 2: three full weeks in a row -> full_barn, lantern (streak), all_rounder (3 per category), first_spoon
select pg_temp.done(2, w::date, s) from generate_series('2026-10-12'::date, '2026-10-26', interval '7 days') w, generate_series(1, 5) s;
select is(private.evaluate_achievements(pg_temp.mid(2), pg_temp.season()),
          array['first_spoon', 'full_barn', 'lantern', 'all_rounder'], 'total_completed, full_weeks, streak_weeks and all_categories');
select is(private.evaluate_achievements(pg_temp.mid(2), pg_temp.season()), '{}'::text[], 'nothing unlocks twice');
select is((select array_agg(delta order by achievement_code) from public.points_ledger where member_id = pg_temp.mid(2) and reason = 'achievement'),
          array[15, 5, 10, 15], 'the bonus points are the catalog values');

-- 3: five social missions -> barn_dance (category_completed)
select pg_temp.done(3, w::date, 1) from generate_series('2026-10-12'::date, '2026-11-09'::date, interval '7 days') w;
select ok('barn_dance' = any (private.evaluate_achievements(pg_temp.mid(3), pg_temp.season())), 'category_completed: five Social');

-- 4: a completed reroll replacement -> shaken_sack (secret)
insert into public.assignments (id, member_id, season_id, week_start, slot, challenge_id, status)
select '30000000-0000-0000-0000-000000000001', pg_temp.mid(4), pg_temp.season(), '2026-10-26', 3, c.id, 'rerolled'
from public.challenges c where c.category = 'learning' and c.workplace_id = '10000000-0000-0000-0000-000000000001' order by c.title_nb limit 1;
select pg_temp.done(4, '2026-10-26', 3, null, '30000000-0000-0000-0000-000000000001', 1);
select ok('shaken_sack' = any (private.evaluate_achievements(pg_temp.mid(4), pg_temp.season())), 'completed_rerolled: a mission from the sack');

-- 5 + 6: completed_on, in local time (23:30 Oslo on 22 December is 22:30 UTC, still the 22nd)
select pg_temp.done(5, '2026-12-21', 1, '2026-12-23 12:00:00+01');
select pg_temp.done(6, '2026-12-07', 1, '2026-12-13 08:00:00+01');
select pg_temp.clock_oslo('2026-12-23 13:00');
select ok('butter_eye' = any (private.evaluate_achievements(pg_temp.mid(5), pg_temp.season())), 'completed_on: 23 December');
select ok(not 'lucia' = any (private.evaluate_achievements(pg_temp.mid(5), pg_temp.season())), 'the wrong date does not unlock lucia');
select ok('lucia' = any (private.evaluate_achievements(pg_temp.mid(6), pg_temp.season())), 'completed_on: 13 December');
select pg_temp.done(1, '2026-11-02', 1, '2026-11-04 23:30:00+01');
select pg_temp.done(1, '2026-12-14', 1, '2026-12-22 23:30:00+01');
select ok(not 'butter_eye' = any (private.evaluate_achievements(pg_temp.mid(1), pg_temp.season())), 'a completion at 23:30 on the 22nd is not the 23rd');
select pg_temp.done(1, '2026-12-14', 2, '2026-12-23 00:30:00+01');
select ok('butter_eye' = any (private.evaluate_achievements(pg_temp.mid(1), pg_temp.season())), 'but 00:30 on the 23rd is');

-- totals
select pg_temp.clock_oslo('2026-12-20 12:00');
select pg_temp.done(1, w::date, s) from generate_series('2026-10-12'::date, '2026-11-23'::date, interval '7 days') w, generate_series(1, 5) s
where not (w = '2026-10-26' and s = 1) and not (w = '2026-11-02' and s = 1);
select is((select count(*)::int from public.assignments where member_id = pg_temp.mid(1) and status = 'completed') >= 25, true, 'sanity: member 1 has at least 25 completions');
select ok('farm_nisse' = any (private.evaluate_achievements(pg_temp.mid(1), pg_temp.season())), 'total_completed: 25 in a season');

-- the streak counts only weeks with at least three completions and survives an unfinished current week
select is(private.current_streak(pg_temp.mid(2), pg_temp.season(), '2026-10-26'), 3, 'current_streak counts three weeks');
select is(private.current_streak(pg_temp.mid(2), pg_temp.season(), '2026-11-02'), 3, 'an unfinished current week does not break it');
select is(private.current_streak(pg_temp.mid(3), pg_temp.season(), '2026-11-09'), 0, 'one mission a week is no streak');

-- secret badges stay hidden from the catalog until unlocked
select pg_temp.act_as(('00000000-0000-0000-0000-0000000001' || lpad('4', 2, '0'))::uuid);
select ok(exists (select 1 from public.achievements where code = 'shaken_sack'), 'the unlocked secret badge is visible to its owner');
reset role;
select pg_temp.act_as(('00000000-0000-0000-0000-0000000001' || lpad('3', 2, '0'))::uuid);
select ok(not exists (select 1 from public.achievements where code = 'shaken_sack'), 'and still hidden from others');

select * from finish();
rollback;
