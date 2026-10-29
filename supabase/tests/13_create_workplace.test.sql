begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@firma.no'),
  ('00000000-0000-0000-0000-00000000000b', 'b@firma.no'),
  ('00000000-0000-0000-0000-00000000000c', 'c@firma.no'),
  ('00000000-0000-0000-0000-00000000000d', 'd@firma.no');

create function pg_temp.act_as(p_user uuid, p_email text default null) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select plan(16);

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'a@firma.no');
select is((select can_create_game()), 'ok', 'there is room for a new game');
select is((select create_workplace('  Nissene AS ', 'laaven', ' Ivar Ruud ') ? 'workplace_id'), true,
          'anyone signed in can make a game');
select is((select me() ->> 'role'), 'admin', 'the creator is its admin');
select is((select me() ->> 'name'), 'Ivar Ruud', 'the creator plays under the chosen name, trimmed');
select is((select me() ->> 'story'), 'laaven', 'in the chosen story');
select is((select me() ->> 'workplace_name'), 'Nissene AS', 'the game name is trimmed');

reset role;
select is((select count(*)::int from public.challenges c join public.workplaces w on w.id = c.workplace_id
           where w.name = 'Nissene AS'), (select count(*)::int from public.catalog_templates),
          'the game gets a copy of the starter catalog');
select is((select created_by from public.workplaces where name = 'Nissene AS'),
          '00000000-0000-0000-0000-00000000000a'::uuid, 'the creator is recorded');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'a@firma.no');
select throws_ok($$select create_workplace('Enda ett', 'gaarden', 'Grøtnissen')$$, 'P0001', 'already_member',
                 'a member cannot make another game (one game per account for now)');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b@firma.no');
select throws_ok($$select create_workplace('x', 'gaarden', 'Grøtnissen')$$, 'P0001', 'invalid_input',
                 'a too short game name is refused');

-- the per-creator limit: c already made three games
reset role;
insert into public.workplaces (name, slug, created_by)
select 'C ' || i, 'c-game-' || i, '00000000-0000-0000-0000-00000000000c' from generate_series(1, 3) i;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'c@firma.no');
select is((select can_create_game()), 'limit', 'a creator at the limit is told so');
select throws_ok($$select create_workplace('C 4', 'gaarden', 'Grøtnissen')$$, 'P0001', 'creator_limit',
                 'a fourth game is refused');

-- the cap on all games
reset role;
update public.platform_limits set max_workplaces = (select count(*) from public.workplaces);
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'd@firma.no');
select is((select can_create_game()), 'full', 'a full platform says so');
select throws_ok($$select create_workplace('Siste plass', 'gaarden', 'Grøtnissen')$$, 'P0001', 'capacity_reached',
                 'no game is made once the cap is reached');

-- limits are invisible to clients, and anon cannot call anything
select throws_ok('select * from public.platform_limits', '42501', null, 'clients cannot read the limits');
reset role;
set local role anon;
select throws_ok($$select can_create_game()$$, '42501', null, 'anon cannot ask');

select * from finish();
rollback;
