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

-- An eight-week season (12 Oct to 6 Dec 2026, across the DST change on 25 Oct) with 24 players
-- of four kinds. Completions are random but seeded, so the run is repeatable.
--   kind 1: perfect (completes everything)   kind 2: steady (80 %)
--   kind 3: casual (45 %)                    kind 4: ghost (joins, never plays)
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid, 's' || i || '@firma.no' from generate_series(1, 24) i;
insert into public.members (id, workplace_id, user_id, nisse_name)
select ('20000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid, '10000000-0000-0000-0000-000000000001',
       ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid, 'Sim' || i from generate_series(1, 24) i;
create temp table kinds as
select ('20000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid as member_id,
       ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid as user_id,
       case when i <= 3 then 1 when i <= 12 then 2 when i <= 21 then 3 else 4 end as kind,
       case when i <= 3 then 1.0 when i <= 12 then 0.8 when i <= 21 then 0.45 else 0 end as p
from generate_series(1, 24) i;

create function pg_temp.play_week(p_monday date) returns void language plpgsql as $$
declare r record;
begin
  perform pg_temp.clock_oslo((p_monday + 2)::text || ' 12:00');
  for r in select k.user_id, a.id, k.p from kinds k
           join public.assignments a on a.member_id = k.member_id
           where a.week_start = p_monday and a.status = 'open' order by k.member_id, a.slot
  loop
    if random() < r.p then
      perform set_config('request.jwt.claims', json_build_object('sub', r.user_id)::text, true);
      perform public.complete_assignment(r.id);
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

select setseed(0.42);
select plan(10);

do $$
declare wk date;
begin
  for wk in select generate_series('2026-10-12'::date, '2026-11-30'::date, interval '7 days')::date loop
    perform pg_temp.clock_oslo(wk::text || ' 06:05');
    perform private.hourly_tick();
    perform pg_temp.play_week(wk);
  end loop;
  perform pg_temp.clock_oslo('2026-12-07 06:05');
  perform private.hourly_tick();
end $$;

select is((select status::text from public.seasons where workplace_id = '10000000-0000-0000-0000-000000000001'), 'finished', 'the season has finished');
select is((select count(*)::int from public.week_closures where workplace_id = '10000000-0000-0000-0000-000000000001'), 8, 'eight weeks closed');
select is((select count(*)::int from public.assignments), (select count(*)::int from public.members) * 8 * 5, 'every member had five slots in each of the eight weeks');
select is((select count(*)::int from public.job_runs where ok is not true), 0, 'no tick failed');

-- the perfect players
select is((select sum(delta)::int from public.points_ledger l join kinds k using (member_id) where k.kind = 1 and l.reason = 'full_week') / 3, 200, 'a perfect season pays 8 x 25 in full-week bonuses');
select is((select sum(delta)::int from public.points_ledger l join kinds k using (member_id) where k.kind = 1 and l.reason = 'streak') / 3, 110, 'and 5+10+15+20+20+20+20 in streak bonuses');
select is((select count(*)::int from public.member_achievements ma join kinds k using (member_id) where k.kind = 1 and ma.achievement_code in ('full_barn', 'lantern', 'northern_light', 'farm_nisse', 'chief_nisse')), 15, 'perfect players unlock full_barn, lantern, northern_light, farm_nisse and chief_nisse');
select is((select count(*)::int from public.points_ledger l join kinds k using (member_id) where k.kind = 4), 0, 'ghosts earn nothing');

-- every ledger total equals its parts, and the leaderboard agrees
select is((select count(*)::int from (select member_id from public.points_ledger group by member_id, season_id having sum(delta) < 0) t), 0, 'no negative totals');
select sum(delta)::int as ledger_total from public.points_ledger \gset
select pg_temp.act_as('00000000-0000-0000-0000-000000000201');
select is((select sum(points)::int from leaderboard('season')), :ledger_total, 'the leaderboard total equals the ledger');
reset role;

-- summary for the PR description
select diag(format('kind %s: %s players, avg %s points, avg %s completed missions, avg %s badges',
  s.kind, s.n, round(s.pts, 1), round(s.done, 1), round(s.badges, 1)))
from (
  select k.kind, count(*) n,
         avg(coalesce((select sum(delta) from public.points_ledger l where l.member_id = k.member_id), 0)) pts,
         avg((select count(*) from public.assignments a where a.member_id = k.member_id and a.status = 'completed')) done,
         avg((select count(*) from public.member_achievements ma where ma.member_id = k.member_id)) badges
  from kinds k group by k.kind
) s order by s.kind;
select diag(format('ledger by reason: %s', (select string_agg(reason || '=' || total, ', ' order by reason) from (select reason, sum(delta) total from public.points_ledger group by reason) t)));

select * from finish();
rollback;
