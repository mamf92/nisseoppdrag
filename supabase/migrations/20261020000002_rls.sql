-- Nisseoppdrag: privileges + Row Level Security (draft reference migration, owned by WP2)
-- Model: default deny. Clients (role `authenticated`) may SELECT what RLS allows and may
-- write directly ONLY to `challenges` (admins) and nothing else. Every game action goes
-- through a security-definer RPC in 0003_game_functions.sql. `anon` gets nothing.

-- ---------- 1. strip default grants ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
-- PUBLIC's execute right on new functions is a role-wide default, so it can only be removed
-- without `in schema`. This role (the migration owner) then creates every function locked down.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Functions in `private` are reachable through the schema grant below, so they must not keep
-- PostgreSQL's default PUBLIC execute right. Each one that clients need is granted by name.
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

-- ---------- 2. membership helpers (private, security definer, no recursion through RLS) ----------
create function private.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.members m where m.user_id = auth.uid()
$$;

create function private.my_workplace_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.workplace_id from public.members m where m.user_id = auth.uid()
$$;

create function private.is_admin_of(p_workplace uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m
                 where m.user_id = auth.uid() and m.workplace_id = p_workplace and m.role = 'admin')
      or exists (select 1 from public.platform_admins p where p.user_id = auth.uid())
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_member_id(), private.my_workplace_id(),
                          private.is_admin_of(uuid) to authenticated;

-- ---------- 3. enable RLS everywhere (and force it for table owners in tests) ----------
alter table public.platform_admins     enable row level security;
alter table public.workplaces          enable row level security;
alter table public.members             enable row level security;
alter table public.invites             enable row level security;
alter table public.seasons             enable row level security;
alter table public.challenges          enable row level security;
alter table public.assignments         enable row level security;
alter table public.points_ledger       enable row level security;
alter table public.achievements        enable row level security;
alter table public.member_achievements enable row level security;
alter table public.week_closures       enable row level security;
alter table public.job_runs            enable row level security;
alter table public.audit_log           enable row level security;

-- ---------- 4. grants (the ceiling) + policies (the rows) ----------

-- workplaces: members see their own workplace. Writes via RPC only.
grant select on public.workplaces to authenticated;
create policy workplaces_select on public.workplaces for select to authenticated
  using (id = (select private.my_workplace_id()));

-- members: colleagues see nisse name, avatar and role. Not user_id, and never email (it is not here).
-- A player finds their own row through public.me().
grant select (id, workplace_id, nisse_name, avatar, role, joined_at) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (workplace_id = (select private.my_workplace_id()));

-- invites: admins of the workplace may list them (hash only). Create/redeem via RPC.
grant select (id, workplace_id, role, expires_at, max_uses, uses, created_at) on public.invites to authenticated;
create policy invites_admin_select on public.invites for select to authenticated
  using ((select private.is_admin_of(workplace_id)));

-- seasons: members read; admins write via RPC (validation of dates lives there).
grant select on public.seasons to authenticated;
create policy seasons_select on public.seasons for select to authenticated
  using (workplace_id = (select private.my_workplace_id()));

-- challenges: players see active ones in their workplace; admins see and edit all of theirs.
grant select on public.challenges to authenticated;
grant insert (workplace_id, category, title_nb, title_en, body_nb, body_en, difficulty, points, is_active)
  on public.challenges to authenticated;
grant update (category, title_nb, title_en, body_nb, body_en, difficulty, points, is_active, archived_at)
  on public.challenges to authenticated;
create policy challenges_select on public.challenges for select to authenticated
  using (workplace_id = (select private.my_workplace_id())
         and ((is_active and archived_at is null) or (select private.is_admin_of(workplace_id))));
create policy challenges_admin_insert on public.challenges for insert to authenticated
  with check ((select private.is_admin_of(workplace_id)));
create policy challenges_admin_update on public.challenges for update to authenticated
  using ((select private.is_admin_of(workplace_id)))
  with check ((select private.is_admin_of(workplace_id)));
-- no DELETE grant: assigned challenges are archived, never deleted (FK restrict).

-- assignments: a player sees only their own. Admin statistics come from admin_stats() (aggregates).
grant select on public.assignments to authenticated;
create policy assignments_own on public.assignments for select to authenticated
  using (member_id = (select private.my_member_id()));

-- points_ledger: own rows only. Leaderboards come from public.leaderboard() (totals per nisse).
grant select on public.points_ledger to authenticated;
create policy ledger_own on public.points_ledger for select to authenticated
  using (member_id = (select private.my_member_id()));

-- achievements: the catalog is readable by every signed-in player; secret ones only once unlocked.
grant select on public.achievements to authenticated;
create policy achievements_select on public.achievements for select to authenticated
  using (not is_secret or exists (
    select 1 from public.member_achievements ma
    where ma.achievement_code = code and ma.member_id = (select private.my_member_id())));

-- member_achievements: badges are visible to colleagues (it is a social game).
grant select on public.member_achievements to authenticated;
create policy member_achievements_select on public.member_achievements for select to authenticated
  using (member_id in (select m.id from public.members m
                       where m.workplace_id = (select private.my_workplace_id())));

-- audit_log: admins of the workplace read; rows are written by RPCs only.
grant select on public.audit_log to authenticated;
create policy audit_admin_select on public.audit_log for select to authenticated
  using ((select private.is_admin_of(workplace_id)));

-- platform_admins, week_closures, job_runs: no grants, no policies => invisible to clients.
