-- Nisseoppdrag: platform-admin RPCs and the starter-catalog template table (WP2).
-- Platform admins are rows in public.platform_admins, added by hand with SQL by the owner.
-- They create workplaces; they do not get a UI.

-- Starter catalog copied into every new workplace. Seeded by WP9. No grants, no policies:
-- invisible to clients; only security-definer functions read it.
create table public.catalog_templates (
  id         bigint generated always as identity primary key,
  category   public.challenge_category not null,
  title_nb   text not null check (char_length(title_nb) between 3 and 80),
  title_en   text not null check (char_length(title_en) between 3 and 80),
  body_nb    text not null default '' check (char_length(body_nb) <= 400),
  body_en    text not null default '' check (char_length(body_en) <= 400),
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  points     smallint not null default 10 check (points between 5 and 50)
);
alter table public.catalog_templates enable row level security;

create function private.require_platform_admin() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.platform_admins p where p.user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
end $$;

-- Creates a workplace with a copy of the starter catalog and returns a first admin invite code
-- (plaintext, shown once; only its hash is stored). The workplace has no season yet: the first
-- admin creates one in Nissefars kontor.
create function public.platform_create_workplace(
  p_name text, p_slug text, p_allowed_domains text[] default '{}')
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_wp uuid; v_code text;
begin
  perform private.require_platform_admin();
  begin
    insert into public.workplaces (name, slug, allowed_email_domains)
    values (btrim(p_name), btrim(p_slug), coalesce((select array_agg(lower(btrim(d))) from unnest(p_allowed_domains) d), '{}'))
    returning id into v_wp;
  exception
    when unique_violation then raise exception 'slug_taken';
    when check_violation then raise exception 'invalid_input';
  end;
  insert into public.challenges (workplace_id, category, title_nb, title_en, body_nb, body_en, difficulty, points, created_by)
  select v_wp, t.category, t.title_nb, t.title_en, t.body_nb, t.body_en, t.difficulty, t.points, auth.uid()
  from public.catalog_templates t;
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=0O1Il', ''), 1, 10));
  insert into public.invites (workplace_id, code_hash, role, expires_at, created_by)
  values (v_wp, extensions.digest(v_code, 'sha256'), 'admin', now() + interval '30 days', auth.uid());
  insert into public.audit_log (workplace_id, actor, action, target) values (v_wp, auth.uid(), 'workplace.create', p_slug);
  return v_code;
end $$;

-- Time of the last successful hourly tick (null if there has been none). Monitoring calls this.
create function public.platform_health() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return (select max(j.finished_at) from public.job_runs j where j.job = 'hourly_tick' and j.ok);
end $$;

grant execute on function
  public.platform_create_workplace(text, text, text[]), public.platform_health()
to authenticated;
