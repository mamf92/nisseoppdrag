-- Nisseoppdrag: one name per story.
-- A player chooses a story (Låven or Gården) and has one name for each story they have played:
-- a farmer name in Låven, a nisse name in Gården. They can switch story at any time; points and
-- badges are tied to the member, so they never change. There is no avatar (decided 2026-10-22);
-- members.avatar stays in the table, unused.

create type public.story as enum ('gaarden', 'laaven');

alter table public.members
  add column story       public.story not null default 'gaarden',
  add column farmer_name text check (char_length(farmer_name) between 2 and 40
                                     and farmer_name !~ '[<>@]'),
  alter column nisse_name drop not null,
  add constraint members_name_for_story check (
    case story when 'gaarden' then nisse_name is not null else farmer_name is not null end),
  add constraint members_workplace_farmer_name_key unique (workplace_id, farmer_name);

grant select (story, farmer_name) on public.members to authenticated;

-- A name is unique across both stories in a workplace, so the leaderboard never shows two
-- players under the same name when one plays Gården and the other Låven.
create function private.members_names_unique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.members m
    where m.workplace_id = new.workplace_id and m.id <> new.id
      and (lower(m.nisse_name) in (lower(new.nisse_name), lower(new.farmer_name))
        or lower(m.farmer_name) in (lower(new.nisse_name), lower(new.farmer_name)))
  ) then
    raise exception 'name_taken' using errcode = '23505';
  end if;
  return new;
end $$;

create trigger members_names_unique before insert or update of nisse_name, farmer_name
  on public.members for each row execute function private.members_names_unique();

-- the name for the story the member is playing right now
create function private.display_name(p_story public.story, p_nisse text, p_farmer text) returns text
language sql immutable set search_path = '' as $$
  select case p_story when 'laaven' then p_farmer else p_nisse end
$$;

create or replace function public.me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member_id', m.id, 'workplace_id', m.workplace_id, 'workplace_name', w.name,
    'role', m.role, 'story', m.story, 'nisse_name', m.nisse_name, 'farmer_name', m.farmer_name,
    'name', private.display_name(m.story, m.nisse_name, m.farmer_name),
    'is_platform_admin', exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  from public.members m join public.workplaces w on w.id = m.workplace_id
  where m.user_id = auth.uid()
$$;

-- The leaderboard shows each player under the name for the story they play right now.
drop function public.leaderboard(text);
create function public.leaderboard(p_scope text default 'season')
returns table (member_id uuid, name text, points bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with ws as (
    select w.id, w.timezone, s.id as season_id
    from public.workplaces w
    join public.seasons s on s.workplace_id = w.id and s.status in ('active', 'finished')
    where w.id = private.my_workplace_id()
    order by (s.status = 'active') desc, s.ends_on desc limit 1
  ),
  totals as (
    select m.id, private.display_name(m.story, m.nisse_name, m.farmer_name) as name,
           coalesce(sum(l.delta), 0)::bigint as points
    from ws join public.members m on m.workplace_id = ws.id
    left join public.points_ledger l
      on l.member_id = m.id and l.season_id = ws.season_id
     and (p_scope = 'season' or l.week_start = private.week_of(ws.timezone))
    group by m.id, m.story, m.nisse_name, m.farmer_name
  )
  select id, name, points, rank() over (order by points desc)
  from totals order by points desc, name
  limit 200
$$;

-- Sets the story the caller plays. p_name is the name for that story; leave it out to go back to
-- a name the player already has. A story with no name yet needs one ('name_required').
drop function public.update_profile(text, jsonb);
create function public.update_profile(p_story public.story, p_name text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_m public.members; v_name text := nullif(btrim(p_name), '');
begin
  select * into v_m from public.members where user_id = auth.uid();
  if not found then raise exception 'not_a_member'; end if;
  if p_story = 'laaven' then
    if v_name is null and v_m.farmer_name is null then raise exception 'name_required'; end if;
    update public.members set story = p_story, farmer_name = coalesce(v_name, farmer_name) where id = v_m.id;
  else
    if v_name is null and v_m.nisse_name is null then raise exception 'name_required'; end if;
    update public.members set story = p_story, nisse_name = coalesce(v_name, nisse_name) where id = v_m.id;
  end if;
exception
  when unique_violation then raise exception 'name_taken';
  when check_violation then raise exception 'invalid_input';
end $$;

-- Joining takes the story and the name for it.
drop function public.redeem_invite(text, text, jsonb);
create function public.redeem_invite(p_code text, p_story public.story, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_inv public.invites; v_wp public.workplaces; v_domain text; v_name text := btrim(p_name);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  select * into v_inv from public.invites
   where code_hash = extensions.digest(upper(btrim(p_code)), 'sha256') for update;
  if v_inv.id is null or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses then
    raise exception 'invite_invalid';
  end if;
  select * into v_wp from public.workplaces where id = v_inv.workplace_id;
  if cardinality(v_wp.allowed_email_domains) > 0 then
    v_domain := lower(split_part(auth.jwt() ->> 'email', '@', 2));
    if not v_domain = any (v_wp.allowed_email_domains) then raise exception 'domain_not_allowed'; end if;
  end if;
  insert into public.members (workplace_id, user_id, role, story, nisse_name, farmer_name)
  values (v_wp.id, auth.uid(), v_inv.role, p_story,
          case p_story when 'gaarden' then v_name end,
          case p_story when 'laaven' then v_name end);
  update public.invites set uses = uses + 1 where id = v_inv.id;
  return jsonb_build_object('workplace_id', v_wp.id);
exception
  when unique_violation then raise exception 'name_taken';
  when check_violation then raise exception 'invalid_input';
end $$;

grant execute on function
  public.leaderboard(text), public.update_profile(public.story, text),
  public.redeem_invite(text, public.story, text)
to authenticated;
