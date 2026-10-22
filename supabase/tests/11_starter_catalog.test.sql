begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select is((select count(*)::int from public.catalog_templates), 60, 'the starter catalog has 60 challenges');
select is(
  (select array_agg(n) from (select count(*)::int n from public.catalog_templates group by category) t),
  array[12, 12, 12, 12, 12], 'twelve per category');
select is(
  (select array_agg(n order by difficulty) from (select difficulty, count(*)::int n from public.catalog_templates group by difficulty) t),
  array[25, 25, 10], 'difficulty mix 5/5/2 per category');
select is((select count(*)::int from public.catalog_templates where points <> difficulty * 10), 0, 'points follow difficulty (10/20/30)');
select is((select count(*)::int from public.catalog_templates where title_nb = title_en), 0, 'every title has a separate English text');
select is((select count(*)::int from (select title_nb from public.catalog_templates group by title_nb having count(*) > 1) t), 0, 'titles are unique');
select is((select count(*)::int from public.catalog_templates where body_nb = '' or body_en = ''), 0, 'every challenge has a description in both languages');

-- a new workplace gets the whole catalog
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'd@x.no');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000d');
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select platform_create_workplace('Ny AS', 'ny-as', '{}') is not null as created \gset
reset role;
select is((select count(*)::int from public.challenges c join public.workplaces w on w.id = c.workplace_id where w.slug = 'ny-as' and c.is_active), 60, 'platform_create_workplace copies all 60');

select * from finish();
rollback;
