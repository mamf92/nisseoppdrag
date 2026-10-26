-- Nisseoppdrag: names that are already taken, and a harder guarantee that nobody shares one.
-- Onboarding offers only names that are free. The list comes from taken_names(), which anyone
-- holding a valid invite code may call (colleagues see each other's names anyway). The database
-- still decides: the checks below refuse a taken name whatever the client sends.

-- Exact duplicates were already refused per column; these also refuse "ola haugen" next to
-- "Ola Haugen", and cannot be raced past.
create unique index members_workplace_farmer_name_ci_key
  on public.members (workplace_id, lower(farmer_name));
create unique index members_workplace_nisse_name_ci_key
  on public.members (workplace_id, lower(nisse_name));

-- The cross-story check (a nisse name equal to a colleague's farmer name) cannot be a plain
-- unique index, so it takes a lock per workplace: two sign-ups with the same name queue up
-- instead of both passing the check.
create or replace function private.members_names_unique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workplace_id::text, 0));
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

-- The names already in use in the workplace an invite code belongs to, lower-cased, from both
-- stories. Same checks as redeem_invite (valid code, allowed e-mail domain), without using it up.
create function public.taken_names(p_code text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v_inv public.invites; v_wp public.workplaces; v_domain text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_inv from public.invites
   where code_hash = extensions.digest(upper(btrim(p_code)), 'sha256');
  if v_inv.id is null or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses then
    raise exception 'invite_invalid';
  end if;
  select * into v_wp from public.workplaces where id = v_inv.workplace_id;
  if cardinality(v_wp.allowed_email_domains) > 0 then
    v_domain := lower(split_part(auth.jwt() ->> 'email', '@', 2));
    if not v_domain = any (v_wp.allowed_email_domains) then raise exception 'domain_not_allowed'; end if;
  end if;
  return coalesce((
    select array_agg(u.n order by u.n collate "C")
    from (select distinct n from public.members m,
            lateral unnest(array[lower(m.nisse_name), lower(m.farmer_name)]) as n
          where m.workplace_id = v_wp.id and n is not null) u), '{}');
end $$;

revoke execute on function public.taken_names(text) from public, anon;
grant execute on function public.taken_names(text) to authenticated;
