-- A skipped mission can be taken back while its week is still open. The skip token is the
-- 'skipped' row itself, so putting the row back to 'open' frees the week's skip again.
create function public.unskip_assignment(p_assignment uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_member uuid := private.my_member_id(); v_open record; v_row public.assignments;
begin
  if v_member is null then raise exception 'not_a_member'; end if;
  select * into v_row from public.assignments where id = p_assignment for update;
  if v_row.id is null or v_row.member_id <> v_member then raise exception 'not_found'; end if;
  select * into v_open from private.open_week_for(v_member);
  if v_open.week_start is distinct from v_row.week_start then raise exception 'week_closed'; end if;
  if v_row.status <> 'skipped' then raise exception 'not_skipped'; end if;
  update public.assignments set status = 'open' where id = v_row.id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.unskip_assignment(uuid) from public, anon;
grant execute on function public.unskip_assignment(uuid) to authenticated;
