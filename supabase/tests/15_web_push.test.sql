begin;
create extension if not exists pgtap with schema extensions;

-- Fixture: one workplace with an active season, a = admin, b = player, d = signed in, no member.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@firma.no'),
  ('00000000-0000-0000-0000-00000000000d', 'd@annet.no');
insert into public.workplaces (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firma AS', 'firma');
insert into public.members (id, workplace_id, user_id, role, nisse_name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin', 'Grøtnissen'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'player', 'Lyktenissen');
update public.members set story = 'laaven', farmer_name = 'Ola Haugen'
 where id = '20000000-0000-0000-0000-00000000000b';
insert into public.seasons (workplace_id, name, starts_on, ends_on, distribution_hour, status)
values ('10000000-0000-0000-0000-000000000001', 'Jul', '2026-11-02', '2026-12-20', 6, 'active');
insert into public.challenges (workplace_id, category, title_nb, title_en, points)
select '10000000-0000-0000-0000-000000000001', c, c || ' nb ' || i, c || ' en ' || i, 10
from unnest(enum_range(null::public.challenge_category)) c, generate_series(1, 4) i;

create function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

create table private.test_clock (at timestamptz);
insert into private.test_clock values (null);
create function pg_temp.clock_oslo(p text) returns void language sql as
  $$ update private.test_clock set at = p::timestamp at time zone 'Europe/Oslo' $$;

-- a well-formed subscription for device n
create function pg_temp.endpoint(n int) returns text language sql as
  $$ select 'https://fcm.googleapis.com/fcm/send/device-' || n $$;
create function pg_temp.p256dh() returns text language sql as $$ select 'B' || repeat('a', 86) $$;
create function pg_temp.auth() returns text language sql as $$ select repeat('k', 22) $$;

-- the helpers are called while acting as anon or authenticated
grant execute on function pg_temp.act_as(uuid), pg_temp.act_as_anon(), pg_temp.endpoint(int),
  pg_temp.p256dh(), pg_temp.auth() to public;

select plan(32);

-- ---------- who may call what ----------
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.push_subscribe(pg_temp.endpoint(1), pg_temp.p256dh(), pg_temp.auth(), 'https://nisseoppdrag.no') $$,
  '42501', null, 'anon cannot subscribe');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select * from public.push_claim_due() $$, '42501', null,
  'players cannot claim messages');
select throws_ok($$ select * from public.push_claim_test('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'players cannot trigger a test for anyone');
select throws_ok($$ select public.push_forget(array['x']) $$, '42501', null,
  'players cannot forget endpoints');
select throws_ok($$ select public.push_server_config() $$, '42501', null,
  'players cannot read the VAPID key or the cron secret');
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, origin)
     values (auth.uid(), pg_temp.endpoint(9), pg_temp.p256dh(), pg_temp.auth(), 'https://nisseoppdrag.no') $$,
  '42501', null, 'no direct inserts');

-- ---------- subscribing ----------
select isnt(public.push_subscribe(pg_temp.endpoint(1), pg_temp.p256dh(), pg_temp.auth(),
                                  'https://nisseoppdrag.no', 'nb', true, true),
            null, 'a player subscribes a device');
select is((select count(*)::int from public.push_subscriptions), 1, 'and sees it');
select throws_ok($$ select p256dh from public.push_subscriptions $$, '42501', null,
  'the keys are not readable, not even by the owner');
select throws_ok(
  $$ select public.push_subscribe('https://evil.example/collect', pg_temp.p256dh(), pg_temp.auth(), 'https://nisseoppdrag.no') $$,
  '22023', 'bad_subscription', 'only known push services are accepted as endpoints');
select throws_ok(
  $$ select public.push_subscribe(pg_temp.endpoint(2), pg_temp.p256dh(), pg_temp.auth(), 'https://evil.example') $$,
  '22023', 'bad_subscription', 'a tap can only lead to our own site');
select throws_ok(
  $$ select public.push_subscribe(pg_temp.endpoint(2), 'short', pg_temp.auth(), 'https://nisseoppdrag.no') $$,
  '22023', 'bad_subscription', 'malformed keys are refused');
select lives_ok(
  $$ select public.push_subscribe('https://web.push.apple.com/QAbc', pg_temp.p256dh(), pg_temp.auth(),
                                  'https://nisseoppdrag-git-pwa-x.vercel.app', 'en') $$,
  'Apple endpoints and preview origins are fine');
select ok(public.push_update('https://web.push.apple.com/QAbc', 'nb', true, false), 'switches change');
select is((select reminder from public.push_subscriptions where endpoint = 'https://web.push.apple.com/QAbc'),
          false, 'the reminder switch is off');
select ok(public.push_unsubscribe('https://web.push.apple.com/QAbc'), 'a device can be removed');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.push_subscriptions), 0, 'nobody sees another player''s devices');
select is(public.push_unsubscribe(pg_temp.endpoint(1)), false, 'or removes them');
select is(public.push_update(pg_temp.endpoint(1), 'en', false, false), false, 'or changes them');

-- 12 devices for a: only the newest 10 stay
select public.push_subscribe(pg_temp.endpoint(100 + n), pg_temp.p256dh(), pg_temp.auth(), 'https://nisseoppdrag.no')
  from generate_series(1, 12) n;
select is((select count(*)::int from public.push_subscriptions), 10, 'an account keeps at most 10 devices');
reset role;
delete from public.push_subscriptions where user_id = '00000000-0000-0000-0000-00000000000a';

-- ---------- what is due when ----------
select pg_temp.clock_oslo('2026-11-09 05:30');   -- Monday, before distribution
select private.hourly_tick();
select is((select count(*)::int from public.push_claim_due()), 0, 'nothing before the week is out');

select pg_temp.clock_oslo('2026-11-09 06:10');
select private.hourly_tick();
select results_eq(
  $$ select kind, story::text, lang, open_count from public.push_claim_due() $$,
  $$ values ('new_week', 'laaven', 'nb', 5) $$,
  'Monday after distribution: the new-week message, in the player''s story');
select is((select count(*)::int from public.push_claim_due()), 0, 'and only once');

select pg_temp.clock_oslo('2026-11-12 11:40');   -- Thursday morning
select is((select count(*)::int from public.push_claim_due()), 0, 'no reminder before noon');
select pg_temp.clock_oslo('2026-11-12 12:10');
select results_eq($$ select kind, open_count from public.push_claim_due() $$,
                  $$ values ('reminder', 5) $$, 'Thursday noon: a reminder with the open count');
select is((select count(*)::int from public.push_claim_due()), 0, 'and only once');

select pg_temp.clock_oslo('2026-11-19 12:10');   -- next Thursday, but nothing left to do
update public.assignments set status = 'completed'
 where member_id = '20000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.push_claim_due()), 0, 'no reminder when every mission is done');

-- ---------- test messages are rate limited ----------
select is((select count(*)::int from public.push_claim_test('00000000-0000-0000-0000-00000000000b')), 1,
          'a test goes to the player''s own device');
select is((select count(*)::int from public.push_claim_test('00000000-0000-0000-0000-00000000000b')), 0,
          'a second test right away is held back');

-- ---------- VAPID key is stored once ----------
select is(public.push_server_config('{"publicKey":"one","privateJwk":{"d":"x"}}') #>> '{vapid,publicKey}', 'one',
          'the first key pair is stored');
select is(public.push_server_config('{"publicKey":"two","privateJwk":{"d":"y"}}') #>> '{vapid,publicKey}', 'one',
          'a later caller gets the stored pair, not its own');

-- ---------- the account goes, its devices go ----------
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.push_subscriptions), 0, 'deleting the account removes its devices');

select * from finish();
rollback;
