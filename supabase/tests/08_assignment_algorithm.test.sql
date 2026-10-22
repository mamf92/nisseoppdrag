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
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Lyktenissen'),
  ('20000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'player', 'Tomnissen');

select plan(13);
select pg_temp.clock_oslo('2026-10-14 12:00');

-- ---------- scheduled jobs ----------
select is((select count(*)::int from cron.job where jobname in ('nisse-hourly-tick', 'nisse-daily-housekeeping')), 2, 'both jobs are scheduled');
select is((select schedule from cron.job where jobname = 'nisse-hourly-tick'), '5 * * * *', 'the tick runs at minute 5 of every hour');

-- ---------- reroll falls back when the category is exhausted ----------
-- W1 keeps a single Learning challenge, so a Learning reroll has no same-category alternative
update public.challenges set is_active = false
where workplace_id = '10000000-0000-0000-0000-000000000001' and category = 'learning'
  and id <> (select id from public.challenges where workplace_id = '10000000-0000-0000-0000-000000000001' and category = 'learning' order by title_nb limit 1);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select ensure_my_week() -> 'slots' -> 2 ->> 'assignment_id' as learning_slot \gset
select reroll_assignment(:'learning_slot'::uuid) ->> 'assignment_id' as replacement \gset
reset role;
select isnt((select c.category::text from public.assignments a join public.challenges c on c.id = a.challenge_id where a.id = :'replacement'::uuid),
            'learning', 'the replacement comes from another category');
select is((select slot::int from public.assignments where id = :'replacement'::uuid), 3, 'and still sits in slot 3');

-- no alternative at all: the token is not burned
update public.challenges set is_active = false where workplace_id = '10000000-0000-0000-0000-000000000002';
update public.challenges set is_active = true
where id in (select id from public.challenges where workplace_id = '10000000-0000-0000-0000-000000000002' order by title_nb limit 1);

-- ---------- empty and thin catalogs ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is(jsonb_array_length(ensure_my_week() -> 'slots'), 1, 'one active challenge fills exactly one slot');
select is(ensure_my_week() ->> 'state', 'open', 'the week is still open');
select ensure_my_week() -> 'slots' -> 0 ->> 'assignment_id' as only_one \gset
select throws_ok(format('select reroll_assignment(%L)', :'only_one'), 'P0001', 'no_alternative', 'a reroll without alternatives is refused');
reset role;
select is((select status::text from public.assignments where id = :'only_one'::uuid), 'open', 'and the slot is untouched');
select is((select count(*)::int from public.assignments a where a.id = :'only_one'::uuid and exists (select 1 from public.assignments r where r.status = 'rerolled' and r.member_id = a.member_id)), 0, 'the reroll token is not burned');

update public.challenges set is_active = false where workplace_id = '10000000-0000-0000-0000-000000000002';
delete from public.assignments where member_id = '20000000-0000-0000-0000-00000000000d';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is(ensure_my_week() -> 'slots', '[]'::jsonb, 'an empty catalog leaves every slot empty without an error');
reset role;

-- ---------- the draw respects the weights ----------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'e@firma.no');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'player', 'Drawnissen');
-- Social challenges for one member: A never seen, B seen 5 weeks ago, C seen last week.
-- Expected shares: 1 : 0.15 : 0.02 -> A about 85.5 %, B 12.8 %, C 1.7 %.
update public.challenges set is_active = false where workplace_id = '10000000-0000-0000-0000-000000000001' and category = 'social';
update public.challenges set is_active = true
where id in (select id from public.challenges where workplace_id = '10000000-0000-0000-0000-000000000001' and category = 'social' order by title_nb limit 3);
-- the season starts earlier here so that the history belongs to it
update public.seasons set starts_on = '2026-09-07' where workplace_id = '10000000-0000-0000-0000-000000000001';
create function pg_temp.social(n int) returns uuid language sql as
  $$ select id from public.challenges where category = 'social' and is_active and workplace_id = '10000000-0000-0000-0000-000000000001' order by title_nb offset n limit 1 $$;
insert into public.assignments (member_id, season_id, week_start, slot, challenge_id, status)
select '20000000-0000-0000-0000-00000000000e', s.id, v.wk, 1, v.cid, 'completed'
from public.seasons s, (values ('2026-09-07'::date, pg_temp.social(1)), ('2026-10-05'::date, pg_temp.social(2))) v(wk, cid)
where s.workplace_id = '10000000-0000-0000-0000-000000000001';

create temp table draws as
select private.pick_challenge('20000000-0000-0000-0000-00000000000e', (select id from public.seasons where workplace_id = '10000000-0000-0000-0000-000000000001'), '2026-10-12', 'social') as picked
from generate_series(1, 1000);

select cmp_ok((select count(*)::int from draws d where d.picked = pg_temp.social(0)),
              '>', 780, 'the unseen challenge wins most of 1000 draws (expected about 855)');
select cmp_ok((select count(*)::int from draws d where d.picked = pg_temp.social(2)),
              '<', 60, 'the challenge from last week is drawn rarely (expected about 17)');
select ok((select count(*) from draws d where d.picked = pg_temp.social(1)) between 60 and 230, 'the older challenge gets 60 to 230 draws (expected about 128)');

select * from finish();
rollback;
