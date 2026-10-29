-- Nisseoppdrag: anyone signed in can make a game (workplace) and becomes its admin, within limits
-- kept in a table the owner can change with SQL: at most 50 games in all, and at most 3 per
-- creator. Both are checked inside create_workplace(), under a lock, so two sign-ups cannot slip
-- past the cap together.
-- Note: members.user_id is still unique (one game per account in the MVP), so today a creator
-- cannot actually hold more than one game; the per-creator limit starts to matter once an account
-- can be in several games.

alter table public.workplaces
  add column created_by uuid references auth.users (id) on delete set null;
create index workplaces_created_by_idx on public.workplaces (created_by);

-- One row. No grants and no policies: clients never see it, only the functions below do.
create table public.platform_limits (
  singleton             boolean primary key default true check (singleton),
  max_workplaces        int not null default 50 check (max_workplaces >= 0),
  max_games_per_creator int not null default 3 check (max_games_per_creator >= 1)
);
alter table public.platform_limits enable row level security;
insert into public.platform_limits default values;

-- 'ok', 'full' (the cap on all games is reached) or 'limit' (the caller has made enough games).
create function private.creation_state() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when (select count(*) from public.workplaces) >= l.max_workplaces then 'full'
    when (select count(*) from public.workplaces w where w.created_by = auth.uid()) >= l.max_games_per_creator then 'limit'
    else 'ok' end
  from public.platform_limits l
$$;

-- Lets the create page say up front whether there is room, instead of failing after the form.
create function public.can_create_game() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return private.creation_state();
end $$;

-- Makes a game with a copy of the starter catalog and the caller as its admin, playing under
-- p_member_name in p_story. The game has no season yet: the admin sets one up in Nissefars kontor.
create function public.create_workplace(p_game_name text, p_story public.story, p_member_name text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid; v_name text := btrim(p_member_name); v_state text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  perform pg_advisory_xact_lock(hashtextextended('create_workplace', 0));
  v_state := private.creation_state();
  if v_state = 'full' then raise exception 'capacity_reached'; end if;
  if v_state = 'limit' then raise exception 'creator_limit'; end if;
  insert into public.workplaces (name, slug, created_by)
  values (btrim(p_game_name), 'g-' || encode(extensions.gen_random_bytes(5), 'hex'), auth.uid())
  returning id into v_wp;
  insert into public.challenges (workplace_id, category, title_nb, title_en, body_nb, body_en, difficulty, points, created_by)
  select v_wp, t.category, t.title_nb, t.title_en, t.body_nb, t.body_en, t.difficulty, t.points, auth.uid()
  from public.catalog_templates t;
  insert into public.members (workplace_id, user_id, role, story, nisse_name, farmer_name)
  values (v_wp, auth.uid(), 'admin', p_story,
          case p_story when 'gaarden' then v_name end,
          case p_story when 'laaven' then v_name end);
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'workplace.create', 'self_service');
  return jsonb_build_object('workplace_id', v_wp);
exception
  when check_violation then raise exception 'invalid_input';
end $$;

revoke execute on function public.can_create_game(), public.create_workplace(text, public.story, text) from public, anon;
grant execute on function public.can_create_game(), public.create_workplace(text, public.story, text) to authenticated;
