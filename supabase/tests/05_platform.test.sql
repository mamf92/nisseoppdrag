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

delete from public.catalog_templates;  -- the seeded starter catalog is tested in 11_starter_catalog
insert into public.catalog_templates (category, title_nb, title_en, points) values
  ('social', 'Spis lunsj med en ny', 'Lunch with someone new', 10),
  ('kindness', 'Si takk til en kollega', 'Thank a colleague', 10);
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000d');
insert into public.job_runs (job, finished_at, ok) values
  ('hourly_tick', now() - interval '3 hours', true),
  ('hourly_tick', now() - interval '1 hour', true),
  ('hourly_tick', now() - interval '10 minutes', false);

select max(finished_at)::text as last_ok from public.job_runs where ok \gset
select plan(12);

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok('select platform_create_workplace(''Ny AS'', ''ny-as'', ''{}'')', 'P0001', 'forbidden', 'a workplace admin is not a platform admin');
select throws_ok('select platform_health()', 'P0001', 'forbidden', 'platform_health is for platform admins only');
select throws_ok('select count(*) from public.catalog_templates', '42501', null, 'templates are invisible to clients');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'd@annet.no');
select platform_create_workplace('Ny AS', 'ny-as', '{" Ny.NO "}') as code \gset
select is(length(:'code'), 10, 'a platform admin gets a first admin code');
select is(platform_health()::text, :'last_ok', 'platform_health returns the last successful tick');
select throws_ok('select platform_create_workplace(''Ny AS'', ''ny-as'', ''{}'')', 'P0001', 'slug_taken', 'slugs are unique');
select throws_ok('select platform_create_workplace(''Ny AS'', ''X'', ''{}'')', 'P0001', 'invalid_input', 'a bad slug is refused');

reset role;
select is((select count(*)::int from public.challenges c join public.workplaces w on w.id = c.workplace_id where w.slug = 'ny-as'), 2, 'the starter catalog is copied');
select is((select allowed_email_domains from public.workplaces where slug = 'ny-as'), array['ny.no'], 'domains are normalised');
select is((select role::text from public.invites i join public.workplaces w on w.id = i.workplace_id where w.slug = 'ny-as'), 'admin', 'the first invite makes an admin');
select is((select count(*)::int from public.audit_log where action = 'workplace.create'), 1, 'creation is audited');

-- the first admin can join with that code
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b@ny.no');
select redeem_invite(:'code', 'gaarden', 'Førstenissen');
select is((select role::text from public.members where nisse_name = 'Førstenissen'), 'admin', 'the code redeems into an admin');

select * from finish();
rollback;
