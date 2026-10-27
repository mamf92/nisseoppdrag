begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select has_index('public', 'assignments', 'assignments_challenge_id_idx', 'challenge_id');
select has_index('public', 'assignments', 'assignments_replaces_id_idx', 'replaces_id');
select has_index('public', 'audit_log', 'audit_log_actor_idx', 'audit actor');
select has_index('public', 'audit_log', 'audit_log_workplace_id_idx', 'audit workplace');
select has_index('public', 'challenges', 'challenges_created_by_idx', 'challenge author');
select has_index('public', 'invites', 'invites_created_by_idx', 'invite author');
select has_index('public', 'invites', 'invites_workplace_id_idx', 'invite workplace');
select has_index('public', 'member_achievements', 'member_achievements_achievement_code_idx', 'badge code');

select * from finish();
rollback;
