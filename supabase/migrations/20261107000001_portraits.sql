-- Nisseoppdrag: player portraits.
-- A player can pick one portrait from a fixed set of 19 painted heads (20 choices with the drawn
-- nisse), cropped from the approved character sheets (see apps/web/scripts/portraits). Only the id of the choice is stored, and it
-- must be one of the ids in public.portraits. No choice (null) shows the drawn nisse in the
-- wooden ring that the app has always shown. The portrait is the same in both stories.
-- members.avatar (jsonb, unused since 2026-10-22) stays as it is.

create table public.portraits (
  id   text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  sort smallint not null unique
);
-- Reference data for the database only; the app keeps its own list with the image files.
-- RLS on and no grants, so clients cannot read or change it.
alter table public.portraits enable row level security;

insert into public.portraits (id, sort) values
  ('lyktenissen-1', 1), ('lyktenissen-2', 2),
  ('grotnissa-1', 3), ('grotnissa-2', 4), ('grotnissa-3', 5),
  ('lavenissen-1', 6), ('lavenissen-2', 7), ('lavenissen-3', 8),
  ('snonissen-1', 9), ('snonissen-2', 10),
  ('nissefar-1', 11), ('nissefar-3', 12),
  ('fjosnissen-1', 13), ('fjosnissen-2', 14), ('fjosnissen-3', 15),
  ('gamlenissen-1', 16), ('gamlenissen-2', 17),
  ('fjoskatten', 18), ('musa', 19);

alter table public.members
  add column portrait text references public.portraits (id) on update cascade on delete set null;
create index members_portrait_idx on public.members (portrait);

-- Colleagues see each other's portrait, like the name.
grant select (portrait) on public.members to authenticated;

-- Sets the caller's portrait; null goes back to the drawn nisse. Unknown ids are refused.
create function public.set_portrait(p_portrait text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid := private.my_member_id();
begin
  if v_id is null then raise exception 'not_a_member'; end if;
  if p_portrait is not null and not exists (select 1 from public.portraits where id = p_portrait) then
    raise exception 'invalid_input';
  end if;
  update public.members set portrait = p_portrait where id = v_id;
end $$;

create or replace function public.me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member_id', m.id, 'workplace_id', m.workplace_id, 'workplace_name', w.name,
    'role', m.role, 'story', m.story, 'nisse_name', m.nisse_name, 'farmer_name', m.farmer_name,
    'name', private.display_name(m.story, m.nisse_name, m.farmer_name), 'portrait', m.portrait,
    'is_platform_admin', exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  from public.members m join public.workplaces w on w.id = m.workplace_id
  where m.user_id = auth.uid()
$$;

-- The leaderboard also returns each player's portrait id.
drop function public.leaderboard(text);
create function public.leaderboard(p_scope text default 'season')
returns table (member_id uuid, name text, portrait text, points bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with ws as (
    select w.id, w.timezone, s.id as season_id
    from public.workplaces w
    join public.seasons s on s.workplace_id = w.id and s.status in ('active', 'finished')
    where w.id = private.my_workplace_id()
    order by (s.status = 'active') desc, s.ends_on desc limit 1
  ),
  totals as (
    select m.id, private.display_name(m.story, m.nisse_name, m.farmer_name) as name, m.portrait,
           coalesce(sum(l.delta), 0)::bigint as points
    from ws join public.members m on m.workplace_id = ws.id
    left join public.points_ledger l
      on l.member_id = m.id and l.season_id = ws.season_id
     and (p_scope = 'season' or l.week_start = private.week_of(ws.timezone))
    group by m.id, m.story, m.nisse_name, m.farmer_name, m.portrait
  )
  select id, name, portrait, points, rank() over (order by points desc)
  from totals order by points desc, name
  limit 200
$$;

revoke execute on function public.set_portrait(text), public.leaderboard(text) from public, anon;
grant execute on function public.set_portrait(text), public.leaderboard(text) to authenticated;
