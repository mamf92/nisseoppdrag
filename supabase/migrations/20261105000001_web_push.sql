-- Nisseoppdrag: Web Push for the experimental PWA.
--
-- What is stored: one row per browser that turned notifications on. The endpoint and keys are what
-- a push service needs to reach that browser; nothing else about the device (no user agent, no IP).
-- The row belongs to the account and goes with it on delete. Players choose which of the two game
-- notifications they want; the language and the site origin decide how the message reads and
-- where a tap leads.
--
-- Who writes: clients only through the RPCs below. The `push` Edge Function (service role) claims
-- the messages that are due, sends them and forgets endpoints the push service says are gone.
-- The VAPID key pair is made by the Edge Function on first use and kept in Supabase Vault; the
-- private half never leaves the server.

create extension if not exists pg_net;

-- ---------- subscriptions ----------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Only the push services of the browsers we support, so the sender can never be pointed at
  -- an arbitrary URL (no server-side request forgery through a crafted subscription).
  endpoint     text not null unique check (
                 char_length(endpoint) <= 1024
                 and endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'),
  p256dh       text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),   -- 65 bytes, base64url
  auth         text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),     -- 16 bytes, base64url
  -- Where a tap on the notification opens the app: production, a Vercel preview, or local dev.
  origin       text not null check (
                 origin ~ '^https://([a-z0-9-]+\.)*(nisseoppdrag\.no|vercel\.app)$'
                 or origin ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]{2,5})?$'),
  lang         text not null default 'nb' check (lang in ('nb', 'en')),
  new_week     boolean not null default true,   -- Monday: new missions are ready
  reminder     boolean not null default true,   -- Thursday: missions are still open
  created_at   timestamptz not null default now(),
  new_week_for date,                            -- the week a Monday message went out for
  reminder_for date,                            -- the week a Thursday message went out for
  tested_at    timestamptz                      -- last «send me a test», for rate limiting
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A player sees their own devices (to show the switches), never the keys or anyone else's rows.
grant select (id, endpoint, lang, new_week, reminder, created_at)
  on public.push_subscriptions to authenticated;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- client RPCs ----------
-- Saves this browser's subscription for the caller. Switches left null keep their value (on for a
-- new device). The same endpoint is one row: subscribing
-- again updates it, also when another account on the same device used it before. An account
-- keeps at most 10 devices; the oldest goes first.
create function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_origin text,
  p_lang text default 'nb', p_new_week boolean default null, p_reminder boolean default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  begin
    insert into public.push_subscriptions as s
      (user_id, endpoint, p256dh, auth, origin, lang, new_week, reminder)
    values (v_user, p_endpoint, p_p256dh, p_auth, p_origin, coalesce(p_lang, 'nb'),
            coalesce(p_new_week, true), coalesce(p_reminder, true))
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
          origin = excluded.origin, lang = excluded.lang,
          -- null keeps the switch as it was (the app re-saves its subscription on start)
          new_week = coalesce(p_new_week, s.new_week), reminder = coalesce(p_reminder, s.reminder),
          -- a device that changes hands starts afresh
          new_week_for = case when s.user_id = excluded.user_id then s.new_week_for end,
          reminder_for = case when s.user_id = excluded.user_id then s.reminder_for end
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'bad_subscription' using errcode = '22023';
  end;

  delete from public.push_subscriptions
   where user_id = v_user
     and id not in (select id from public.push_subscriptions where user_id = v_user
                    order by created_at desc, id limit 10);
  return v_id;
end $$;

-- Changes the switches (and language) of one of the caller's own devices.
create function public.push_update(
  p_endpoint text, p_lang text, p_new_week boolean, p_reminder boolean)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_found boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_lang not in ('nb', 'en') then raise exception 'bad_subscription' using errcode = '22023'; end if;
  update public.push_subscriptions
     set lang = p_lang, new_week = coalesce(p_new_week, new_week),
         reminder = coalesce(p_reminder, reminder)
   where endpoint = p_endpoint and user_id = auth.uid();
  get diagnostics v_found = row_count;
  return v_found;
end $$;

-- Forgets one of the caller's own devices (turning notifications off, or signing out).
create function public.push_unsubscribe(p_endpoint text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_found boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  get diagnostics v_found = row_count;
  return v_found;
end $$;

grant execute on function public.push_subscribe(text, text, text, text, text, boolean, boolean),
                          public.push_update(text, text, boolean, boolean),
                          public.push_unsubscribe(text)
  to authenticated;

-- ---------- sender RPCs (service role only) ----------

-- Messages due now, claimed in the same statement so two senders never send one twice.
--   new_week: Monday, once the week's missions are out (local time past distribution hour)
--   reminder: Thursday from 12:00 local time, while the player still has open missions
create function public.push_claim_due()
returns table (endpoint text, p256dh text, auth text, origin text, lang text,
               kind text, story public.story, open_count int)
language sql volatile security definer set search_path = '' as $$
  with candidate as (
    select s.id, m.story, w.timezone,
           private.week_of(w.timezone) as week,
           private.local_now(w.timezone) as local_now,
           se.distribution_hour,
           s.new_week, s.reminder, s.new_week_for, s.reminder_for,
           (select count(*) from public.assignments a
             where a.member_id = m.id and a.week_start = private.week_of(w.timezone)
               and a.status = 'open')::int as open_count,
           (select count(*) from public.assignments a
             where a.member_id = m.id and a.week_start = private.week_of(w.timezone)
               and a.status <> 'rerolled')::int as live_count
      from public.push_subscriptions s
      join public.members m on m.user_id = s.user_id
      join public.workplaces w on w.id = m.workplace_id
      join public.seasons se on se.workplace_id = w.id and se.status = 'active'
  ), due as (
    select c.*,
           case
             when c.new_week and c.new_week_for is distinct from c.week
                  and extract(isodow from c.local_now) = 1
                  and c.local_now >= c.week + make_interval(hours => c.distribution_hour)
                  and c.live_count > 0 then 'new_week'
             when c.reminder and c.reminder_for is distinct from c.week
                  and extract(isodow from c.local_now) = 4
                  and extract(hour from c.local_now) >= 12
                  and c.open_count > 0 then 'reminder'
           end as kind
      from candidate c
  )
  update public.push_subscriptions s
     set new_week_for = case when d.kind = 'new_week' then d.week else s.new_week_for end,
         reminder_for = case when d.kind = 'reminder' then d.week else s.reminder_for end
    from due d
   where s.id = d.id and d.kind is not null
  returning s.endpoint, s.p256dh, s.auth, s.origin, s.lang, d.kind, d.story, d.open_count
$$;

-- The caller's own devices for «send me a test», at most once per 20 seconds per device.
create function public.push_claim_test(p_user uuid)
returns table (endpoint text, p256dh text, auth text, origin text, lang text,
               kind text, story public.story, open_count int)
language sql volatile security definer set search_path = '' as $$
  update public.push_subscriptions s
     set tested_at = now()
   where s.user_id = p_user
     and (s.tested_at is null or s.tested_at < now() - interval '20 seconds')
  returning s.endpoint, s.p256dh, s.auth, s.origin, s.lang, 'test'::text,
            coalesce((select m.story from public.members m where m.user_id = p_user), 'gaarden'),
            coalesce((select count(*)::int from public.members m
                        join public.workplaces w on w.id = m.workplace_id
                        join public.assignments a on a.member_id = m.id
                       where m.user_id = p_user and a.status = 'open'
                         and a.week_start = private.week_of(w.timezone)), 0)
$$;

-- Endpoints the push service answered 404/410 for: the browser dropped the subscription.
create function public.push_forget(p_endpoints text[]) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare v_count int;
begin
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- The sender's configuration from Vault: the VAPID key pair (stored on first call, from the key
-- the Edge Function generated; a racing second caller gets the first one's key) and the secret
-- the cron job sends so that only it can start a dispatch.
create function public.push_server_config(p_vapid jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_vapid text; v_cron text;
begin
  perform pg_advisory_xact_lock(hashtext('nisse-push-vapid'));
  select decrypted_secret into v_vapid from vault.decrypted_secrets where name = 'push_vapid';
  if v_vapid is null and p_vapid is not null then
    if jsonb_typeof(p_vapid -> 'publicKey') <> 'string'
       or jsonb_typeof(p_vapid -> 'privateJwk') <> 'object' then
      raise exception 'bad_vapid' using errcode = '22023';
    end if;
    perform vault.create_secret(p_vapid::text, 'push_vapid', 'Web Push VAPID key pair');
    v_vapid := p_vapid::text;
  end if;
  select decrypted_secret into v_cron from vault.decrypted_secrets where name = 'push_cron_secret';
  return jsonb_build_object('vapid', v_vapid::jsonb, 'cron_secret', v_cron);
end $$;

revoke execute on function public.push_claim_due(), public.push_claim_test(uuid),
                           public.push_forget(text[]), public.push_server_config(jsonb)
  from public, anon, authenticated;
grant execute on function public.push_claim_due(), public.push_claim_test(uuid),
                          public.push_forget(text[]), public.push_server_config(jsonb)
  to service_role;

-- ---------- the schedule ----------
-- The cron secret is made here, inside the database. The dispatch URL differs per project, so it
-- is set once per environment (see README):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/push/dispatch', 'push_dispatch_url');
-- Until it is set the job does nothing.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'push_cron_secret', 'Shared secret between pg_cron and the push function');
  end if;
end $$;

create function private.push_tick() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-nisse-cron', v_secret),
    timeout_milliseconds := 20000);
end $$;
revoke execute on function private.push_tick() from public, anon, authenticated;

-- After the hourly tick (:05) has handed out Monday's missions, and once more each half hour.
select cron.schedule('nisse-push-tick', '10,40 * * * *', $$select private.push_tick()$$);
