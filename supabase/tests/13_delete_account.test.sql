begin;
create extension if not exists pgtap with schema extensions;

-- Deleting the auth user (what the delete-account function does) must leave nothing behind: the
-- member, its names, assignments, points, badges and invites it created.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@firma.no');
insert into public.workplaces (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firma AS', 'firma');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin', 'Grøtnissen'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Fjøsnissen');
insert into public.seasons (id, workplace_id, name, starts_on, ends_on, distribution_hour, status)
select '30000000-0000-0000-0000-000000000001', id, 'Jul',
       (date_trunc('week', now() at time zone 'Europe/Oslo') - interval '7 days')::date,
       (date_trunc('week', now() at time zone 'Europe/Oslo') + interval '55 days')::date, 0, 'active'
from public.workplaces;
insert into public.challenges (id, workplace_id, category, title_nb, title_en, points)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'social', 'Si hei', 'Say hi', 10);
insert into public.assignments (id, member_id, season_id, week_start, slot, challenge_id, status, points_awarded)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, m, '30000000-0000-0000-0000-000000000001',
       date_trunc('week', now() at time zone 'Europe/Oslo')::date, 1,
       '40000000-0000-0000-0000-000000000001', 'completed', 10
from (values (1, '20000000-0000-0000-0000-00000000000a'::uuid), (2, '20000000-0000-0000-0000-00000000000b'::uuid)) v(n, m);
insert into public.points_ledger (member_id, season_id, week_start, reason, delta, assignment_id)
select member_id, season_id, week_start, 'challenge', 10, id from public.assignments;
insert into public.member_achievements (member_id, achievement_code)
select id, 'first_spoon' from public.members;
insert into public.invites (workplace_id, code_hash, role, expires_at, created_by)
values ('10000000-0000-0000-0000-000000000001', extensions.digest('X', 'sha256'), 'player',
        now() + interval '1 day', '00000000-0000-0000-0000-00000000000a');

select plan(9);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.members where user_id = '00000000-0000-0000-0000-00000000000b'), 0, 'the member is gone');
select is((select count(*)::int from public.assignments where member_id = '20000000-0000-0000-0000-00000000000b'), 0, 'its assignments are gone');
select is((select count(*)::int from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000b'), 0, 'its points are gone');
select is((select count(*)::int from public.member_achievements where member_id = '20000000-0000-0000-0000-00000000000b'), 0, 'its badges are gone');
select is((select count(*)::int from public.members where user_id = '00000000-0000-0000-0000-00000000000a'), 1, 'a colleague is untouched');
select is((select count(*)::int from public.points_ledger where member_id = '20000000-0000-0000-0000-00000000000a'), 1, 'a colleague keeps their points');

-- the admin's invites stay (created_by is cleared), so the group is not locked out of its code
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.invites), 1, 'an invite outlives the admin who made it');
select is((select created_by from public.invites), null, 'but no longer names them');
select is((select count(*)::int from public.members), 0, 'the group has no members left');

select * from finish();
rollback;
