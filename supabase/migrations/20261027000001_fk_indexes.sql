-- Covering indexes for foreign keys flagged by the Supabase performance advisor. They keep
-- cascading deletes (delete-account, removing a member) and joins from scanning whole tables.
create index if not exists assignments_challenge_id_idx on public.assignments (challenge_id);
create index if not exists assignments_replaces_id_idx on public.assignments (replaces_id);
create index if not exists audit_log_actor_idx on public.audit_log (actor);
create index if not exists audit_log_workplace_id_idx on public.audit_log (workplace_id);
create index if not exists challenges_created_by_idx on public.challenges (created_by);
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists invites_workplace_id_idx on public.invites (workplace_id);
create index if not exists member_achievements_achievement_code_idx
  on public.member_achievements (achievement_code);
