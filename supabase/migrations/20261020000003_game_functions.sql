-- Nisseoppdrag: game rules as database functions (WP2)
-- Every public.* function here is SECURITY DEFINER with an empty search_path, checks auth.uid()
-- itself, and is granted to `authenticated` explicitly at the bottom. Nothing else is callable.
-- Error codes are stable strings the front end maps to bokmål/English copy.

-- ======================================================================
-- time helpers
-- ======================================================================
create function private.local_now(p_tz text) returns timestamp
language sql stable set search_path = '' as $$ select now() at time zone p_tz $$;

create function private.week_of(p_tz text) returns date            -- ISO Monday, local
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone p_tz)::date $$;

-- ======================================================================
-- assignment algorithm (section 7 of the plan)
-- ======================================================================
-- Weighted random pick without replacement (Efraimidis-Spirakis key = random()^(1/w)).
-- Weight 1.0 for never seen this season, 0.15 if seen earlier this season, 0.02 if seen in
-- the last 2 weeks. Excludes anything already in the member's week.
create function private.pick_challenge(
  p_member uuid, p_season uuid, p_week date, p_category public.challenge_category)
returns uuid
language sql volatile set search_path = '' as $$
  with me as (select workplace_id from public.members where id = p_member),
  history as (
    select a.challenge_id, max(a.week_start) as last_week
    from public.assignments a
    where a.member_id = p_member and a.season_id = p_season and a.week_start < p_week
    group by a.challenge_id
  ),
  candidates as (
    select c.id,
           case when h.challenge_id is null then 1.0
                when h.last_week >= p_week - 14 then 0.02
                else 0.15 end as w
    from public.challenges c
    join me on me.workplace_id = c.workplace_id
    left join history h on h.challenge_id = c.id
    where c.is_active and c.archived_at is null
      and (p_category is null or c.category = p_category)
      and not exists (select 1 from public.assignments a
                      where a.member_id = p_member and a.week_start = p_week
                        and a.challenge_id = c.id)
  )
  select id from candidates order by power(random(), 1.0 / w) desc limit 1
$$;

-- Creates the 5 slots for one member and week: slot n = the n-th category. Falls back to any
-- category if a category has run dry. Idempotent: an advisory lock + existence check per slot.
create function private.assign_week(p_member uuid, p_season uuid, p_week date)
returns int
language plpgsql volatile set search_path = '' as $$
declare
  cats public.challenge_category[] :=
    array['social','kindness','learning','collaboration','holiday_fun']::public.challenge_category[];
  v_slot int; v_pick uuid; v_created int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_member::text || p_week::text, 0));
  for v_slot in 1..5 loop
    continue when exists (select 1 from public.assignments
                          where member_id = p_member and week_start = p_week
                            and slot = v_slot and status <> 'rerolled');
    v_pick := private.pick_challenge(p_member, p_season, p_week, cats[v_slot]);
    if v_pick is null then
      v_pick := private.pick_challenge(p_member, p_season, p_week, null);
    end if;
    continue when v_pick is null;   -- empty catalog: slot stays empty, admin dashboard warns
    insert into public.assignments (member_id, season_id, week_start, slot, challenge_id)
    values (p_member, p_season, p_week, v_slot, v_pick);
    v_created := v_created + 1;
  end loop;
  return v_created;
end $$;

-- The week is "open" for a member when their workplace has an active season covering this
-- local week and the local clock has passed Monday distribution_hour.
create function private.open_week_for(p_member uuid,
  out season_id uuid, out week_start date, out tz text)
language sql stable set search_path = '' as $$
  select s.id, private.week_of(w.timezone), w.timezone
  from public.members m
  join public.workplaces w on w.id = m.workplace_id
  join public.seasons s on s.workplace_id = w.id and s.status = 'active'
  where m.id = p_member
    and private.week_of(w.timezone) between s.starts_on and s.ends_on
    and private.local_now(w.timezone)
        >= private.week_of(w.timezone) + make_interval(hours => s.distribution_hour)
$$;

-- ======================================================================
-- player RPCs
-- ======================================================================
create function public.me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member_id', m.id, 'workplace_id', m.workplace_id, 'workplace_name', w.name,
    'role', m.role, 'nisse_name', m.nisse_name, 'avatar', m.avatar,
    'is_platform_admin', exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  from public.members m join public.workplaces w on w.id = m.workplace_id
  where m.user_id = auth.uid()
$$;

-- Called by the dashboard on load. Lazily creates this week's slots if the cron job has not
-- reached this member yet (late joiners, a missed run). Returns this week's live slots + tokens.
create function public.ensure_my_week() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_member uuid := private.my_member_id(); v_open record;
begin
  if v_member is null then raise exception 'not_a_member'; end if;
  select * into v_open from private.open_week_for(v_member);
  if v_open.season_id is null then
    return jsonb_build_object('state', 'no_active_week');
  end if;
  perform private.assign_week(v_member, v_open.season_id, v_open.week_start);
  return jsonb_build_object(
    'state', 'open',
    'week_start', v_open.week_start,
    'closes_at', ((v_open.week_start + 7)::timestamp at time zone v_open.tz),
    'skip_left',   not exists (select 1 from public.assignments where member_id = v_member
                                and week_start = v_open.week_start and status = 'skipped'),
    'reroll_left', not exists (select 1 from public.assignments where member_id = v_member
                                and week_start = v_open.week_start and status = 'rerolled'),
    'slots', (select coalesce(jsonb_agg(jsonb_build_object(
                'assignment_id', a.id, 'slot', a.slot, 'status', a.status,
                'points_awarded', a.points_awarded, 'challenge_id', a.challenge_id,
                'category', c.category, 'title_nb', c.title_nb, 'title_en', c.title_en,
                'body_nb', c.body_nb, 'body_en', c.body_en, 'points', c.points,
                'difficulty', c.difficulty) order by a.slot), '[]'::jsonb)
              from public.assignments a join public.challenges c on c.id = a.challenge_id
              where a.member_id = v_member and a.week_start = v_open.week_start
                and a.status <> 'rerolled'));
end $$;

-- Locks and validates an assignment the caller owns, in the currently open week.
create function private.lock_my_open_assignment(p_assignment uuid)
returns public.assignments
language plpgsql volatile set search_path = '' as $$
declare v_member uuid := private.my_member_id(); v_open record; v_row public.assignments;
begin
  if v_member is null then raise exception 'not_a_member'; end if;
  select * into v_row from public.assignments where id = p_assignment for update;
  if v_row.id is null or v_row.member_id <> v_member then raise exception 'not_found'; end if;
  select * into v_open from private.open_week_for(v_member);
  if v_open.week_start is distinct from v_row.week_start then raise exception 'week_closed'; end if;
  if v_row.status <> 'open' then raise exception 'not_open'; end if;
  return v_row;
end $$;

create function public.complete_assignment(p_assignment uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row public.assignments; v_points smallint; v_new text[];
begin
  v_row := private.lock_my_open_assignment(p_assignment);
  select points into v_points from public.challenges where id = v_row.challenge_id;
  update public.assignments
     set status = 'completed', completed_at = now(), points_awarded = v_points
   where id = v_row.id;
  insert into public.points_ledger (member_id, season_id, week_start, reason, delta, assignment_id)
  values (v_row.member_id, v_row.season_id, v_row.week_start, 'challenge', v_points, v_row.id);
  v_new := private.evaluate_achievements(v_row.member_id, v_row.season_id);
  return jsonb_build_object('points', v_points, 'new_achievements', to_jsonb(v_new));
end $$;

create function public.skip_assignment(p_assignment uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row public.assignments;
begin
  v_row := private.lock_my_open_assignment(p_assignment);
  begin
    update public.assignments set status = 'skipped' where id = v_row.id;
  exception when unique_violation then raise exception 'skip_used';
  end;
  return jsonb_build_object('ok', true);
end $$;

-- Replaces one open slot with a different challenge from the same category (any category if
-- that one is exhausted). The old row keeps status 'rerolled' as the week's reroll token.
create function public.reroll_assignment(p_assignment uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row public.assignments; v_cat public.challenge_category; v_pick uuid; v_new uuid;
begin
  v_row := private.lock_my_open_assignment(p_assignment);
  begin
    update public.assignments set status = 'rerolled' where id = v_row.id;
  exception when unique_violation then raise exception 'reroll_used';
  end;
  select category into v_cat from public.challenges where id = v_row.challenge_id;
  v_pick := coalesce(private.pick_challenge(v_row.member_id, v_row.season_id, v_row.week_start, v_cat),
                     private.pick_challenge(v_row.member_id, v_row.season_id, v_row.week_start, null));
  if v_pick is null then raise exception 'no_alternative'; end if;   -- rolls back the token
  insert into public.assignments (member_id, season_id, week_start, slot, challenge_id, replaces_id)
  values (v_row.member_id, v_row.season_id, v_row.week_start, v_row.slot, v_pick, v_row.id)
  returning id into v_new;
  return jsonb_build_object('assignment_id', v_new);
end $$;

-- Leaderboard for the caller's workplace. Only nisse names, avatars and totals leave the DB.
create function public.leaderboard(p_scope text default 'season')
returns table (member_id uuid, nisse_name text, avatar jsonb, points bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with ws as (
    select w.id, w.timezone, s.id as season_id
    from public.workplaces w
    join public.seasons s on s.workplace_id = w.id and s.status in ('active', 'finished')
    where w.id = private.my_workplace_id()
    order by (s.status = 'active') desc, s.ends_on desc limit 1
  ),
  totals as (
    select m.id, m.nisse_name, m.avatar, coalesce(sum(l.delta), 0)::bigint as points
    from ws join public.members m on m.workplace_id = ws.id
    left join public.points_ledger l
      on l.member_id = m.id and l.season_id = ws.season_id
     and (p_scope = 'season' or l.week_start = private.week_of(ws.timezone))
    group by m.id, m.nisse_name, m.avatar
  )
  select id, nisse_name, avatar, points, rank() over (order by points desc)
  from totals order by points desc, nisse_name
  limit 200
$$;

create function public.update_profile(p_nisse_name text, p_avatar jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.members set nisse_name = btrim(p_nisse_name), avatar = p_avatar
   where user_id = auth.uid();
  if not found then raise exception 'not_a_member'; end if;
exception when unique_violation then raise exception 'name_taken';
end $$;

-- Invite redemption: code is sha256-compared; optional e-mail domain gate reads the JWT claim,
-- the address itself is never stored outside auth.users.
create function public.redeem_invite(p_code text, p_nisse_name text, p_avatar jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_inv public.invites; v_wp public.workplaces; v_domain text;
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
  insert into public.members (workplace_id, user_id, role, nisse_name, avatar)
  values (v_wp.id, auth.uid(), v_inv.role, btrim(p_nisse_name), coalesce(p_avatar, '{}'::jsonb));
  update public.invites set uses = uses + 1 where id = v_inv.id;
  return jsonb_build_object('workplace_id', v_wp.id);
exception when unique_violation then raise exception 'name_taken';
end $$;

-- ======================================================================
-- admin RPCs (all audited)
-- ======================================================================
create function private.require_admin() returns uuid
language plpgsql stable set search_path = '' as $$
declare v_wp uuid := private.my_workplace_id();
begin
  if v_wp is null or not private.is_admin_of(v_wp) then raise exception 'forbidden'; end if;
  return v_wp;
end $$;

-- Returns the plaintext code once; only its hash is stored.
create function public.admin_create_invite(p_role public.member_role, p_days int default 30)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid := private.require_admin(); v_code text;
begin
  if p_days not between 1 and 90 then raise exception 'invalid_input'; end if;
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=0O1Il', ''), 1, 10));
  insert into public.invites (workplace_id, code_hash, role, expires_at, created_by)
  values (v_wp, extensions.digest(v_code, 'sha256'), p_role, now() + make_interval(days => p_days), auth.uid());
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'invite.create', p_role::text);
  return v_code;
end $$;

create function public.admin_set_role(p_member uuid, p_role public.member_role) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid := private.require_admin();
begin
  -- Serialize admin changes per workplace, then recheck under the lock, so two
  -- admins demoting each other cannot both pass the last-admin check.
  perform 1 from public.workplaces where id = v_wp for update;
  if not private.is_admin_of(v_wp) then raise exception 'forbidden'; end if;
  if p_role = 'player' and (select count(*) from public.members where workplace_id = v_wp and role = 'admin') <= 1
     and exists (select 1 from public.members where id = p_member and role = 'admin') then
    raise exception 'last_admin';
  end if;
  update public.members set role = p_role where id = p_member and workplace_id = v_wp;
  if not found then raise exception 'not_found'; end if;
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'member.role', p_member::text || ':' || p_role);
end $$;

create function public.admin_remove_member(p_member uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid := private.require_admin();
begin
  perform 1 from public.workplaces where id = v_wp for update;
  if not private.is_admin_of(v_wp) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.members where id = p_member and user_id = auth.uid()) then raise exception 'cannot_remove_self'; end if;
  delete from public.members where id = p_member and workplace_id = v_wp;
  if not found then raise exception 'not_found'; end if;
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'member.remove', p_member::text);
end $$;

create function public.admin_upsert_season(p_id uuid, p_name text, p_starts date, p_ends date,
  p_hour smallint, p_status public.season_status) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid := private.require_admin(); v_id uuid;
begin
  if p_id is null then
    insert into public.seasons (workplace_id, name, starts_on, ends_on, distribution_hour, status)
    values (v_wp, p_name, p_starts, p_ends, p_hour, p_status) returning id into v_id;
  else
    update public.seasons set name = p_name, starts_on = p_starts, ends_on = p_ends,
           distribution_hour = p_hour, status = p_status
     where id = p_id and workplace_id = v_wp and status <> 'finished' returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'season.upsert', v_id::text);
  return v_id;
exception when unique_violation then raise exception 'season_already_active';
end $$;

create function public.admin_adjust_points(p_member uuid, p_delta int, p_note text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid := private.require_admin(); v_season uuid; v_tz text;
begin
  if p_delta = 0 or abs(p_delta) > 100 or coalesce(btrim(p_note), '') = '' then raise exception 'invalid_input'; end if;
  select s.id, w.timezone into v_season, v_tz from public.seasons s join public.workplaces w on w.id = s.workplace_id
   where s.workplace_id = v_wp and s.status = 'active';
  if v_season is null or not exists (select 1 from public.members where id = p_member and workplace_id = v_wp) then
    raise exception 'not_found';
  end if;
  insert into public.points_ledger (member_id, season_id, week_start, reason, delta, note)
  values (p_member, v_season, private.week_of(v_tz), 'admin_adjustment', p_delta, left(p_note, 120));
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'points.adjust', p_member::text || ':' || p_delta);
end $$;

-- Aggregates only: no per-person activity is exposed to admins beyond the public leaderboard.
create function public.admin_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  with wp as (select private.require_admin() as id),
  cur as (select s.id as season_id, private.week_of(w.timezone) as wk
          from wp join public.workplaces w on w.id = wp.id
          join public.seasons s on s.workplace_id = w.id and s.status = 'active')
  select jsonb_build_object(
    'members', (select count(*) from public.members m, wp where m.workplace_id = wp.id),
    'active_this_week', (select count(distinct a.member_id) from public.assignments a, cur
                         where a.season_id = cur.season_id and a.week_start = cur.wk and a.status = 'completed'),
    'by_category', (select coalesce(jsonb_object_agg(cat, n), '{}'::jsonb) from (
                      select c.category::text as cat, count(*) as n
                      from public.assignments a join public.challenges c on c.id = a.challenge_id, cur
                      where a.season_id = cur.season_id and a.week_start = cur.wk and a.status = 'completed'
                      group by c.category) t),
    'skips', (select count(*) from public.assignments a, cur where a.season_id = cur.season_id and a.week_start = cur.wk and a.status = 'skipped'),
    'rerolls', (select count(*) from public.assignments a, cur where a.season_id = cur.season_id and a.week_start = cur.wk and a.status = 'rerolled'),
    'catalog_low', (select coalesce(jsonb_agg(cat), '[]'::jsonb) from (
                      select e.cat from unnest(enum_range(null::public.challenge_category)) e(cat), wp
                      where (select count(*) from public.challenges c where c.workplace_id = wp.id
                             and c.category = e.cat and c.is_active and c.archived_at is null) < 8) t))
$$;

-- ======================================================================
-- grants: exactly these are callable by signed-in users
-- ======================================================================
grant execute on function
  public.me(), public.ensure_my_week(), public.complete_assignment(uuid),
  public.skip_assignment(uuid), public.reroll_assignment(uuid), public.leaderboard(text),
  public.update_profile(text, jsonb), public.redeem_invite(text, text, jsonb),
  public.admin_create_invite(public.member_role, int), public.admin_set_role(uuid, public.member_role),
  public.admin_remove_member(uuid),
  public.admin_upsert_season(uuid, text, date, date, smallint, public.season_status),
  public.admin_adjust_points(uuid, int, text), public.admin_stats()
to authenticated;

-- ======================================================================
-- placeholder, replaced by WP3 (create or replace in the achievements migration)
-- ======================================================================
create function private.evaluate_achievements(p_member uuid, p_season uuid) returns text[]
language sql volatile set search_path = '' as $$ select '{}'::text[] $$;
