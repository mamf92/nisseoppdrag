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

select plan(14);

-- Row Level Security is on for every table in public, and a table without grants stays closed.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS is enabled on every table in public');

-- Exactly these functions may be executed by signed-in users, and none by anon.
select is(
  (select array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'execute')),
  array[
    'private.is_admin_of', 'private.my_member_id', 'private.my_workplace_id',
    'public.admin_adjust_points', 'public.admin_create_invite', 'public.admin_remove_member',
    'public.admin_set_role', 'public.admin_stats', 'public.admin_upsert_season',
    'public.complete_assignment', 'public.ensure_my_week', 'public.leaderboard', 'public.me',
    'public.platform_create_workplace', 'public.platform_health', 'public.redeem_invite',
    'public.reroll_assignment', 'public.skip_assignment', 'public.update_profile'],
  'authenticated can execute exactly the allowed functions');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon can execute no function in public or private');

-- Every function in public and private pins its search_path (security-definer hygiene).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  0, 'every function sets search_path');

-- Signed-in users may not write game tables directly.
select is(
  (select count(*)::int from information_schema.role_table_grants g
   where g.grantee = 'authenticated' and g.table_schema = 'public'
     and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     and g.table_name <> 'challenges'),
  0, 'authenticated has no write grants outside challenges');
select is(
  (select count(*)::int from information_schema.role_table_grants g
   where g.grantee = 'authenticated' and g.table_schema = 'public' and g.table_name = 'challenges'
     and g.privilege_type in ('DELETE', 'TRUNCATE')),
  0, 'challenges cannot be deleted by clients');
select is(
  (select count(*)::int from information_schema.role_table_grants g
   where g.grantee in ('anon', 'authenticated') and g.table_schema = 'public'
     and g.table_name in ('platform_admins', 'week_closures', 'job_runs', 'catalog_templates')),
  0, 'platform and operations tables have no client grants');
select is(
  (select count(*)::int from information_schema.role_column_grants g
   where g.grantee = 'authenticated' and g.table_name = 'members' and g.column_name = 'user_id'),
  0, 'user_id is not readable from members');
select is(
  (select count(*)::int from information_schema.role_column_grants g
   where g.grantee = 'authenticated' and g.table_name = 'invites' and g.column_name = 'code_hash'),
  0, 'invite hashes are not readable');

-- anon sees nothing
reset role;
select pg_temp.act_as_anon();
select throws_ok('select count(*) from public.members', '42501', null, 'anon cannot read members');
select throws_ok('select count(*) from public.challenges', '42501', null, 'anon cannot read challenges');
select throws_ok('select count(*) from public.achievements', '42501', null, 'anon cannot read achievements');
select throws_ok('select public.me()', '42501', null, 'anon cannot call me()');
select throws_ok('select * from public.leaderboard()', '42501', null, 'anon cannot read the leaderboard');

select * from finish();
rollback;
