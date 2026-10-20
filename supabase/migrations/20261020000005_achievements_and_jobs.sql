-- Nisseoppdrag: clock, achievements, week close and scheduled jobs (WP3).
-- Requires the pg_cron extension (preinstalled on Supabase; enable it under Database > Extensions).

-- ======================================================================
-- clock: every game rule reads time through private.clock() so tests can move it.
-- It only deviates from now() while a table private.test_clock exists. Only the migration
-- owner can create that table (private is closed to clients) and tests create it inside a
-- transaction they roll back, so production always sees the real time.
-- ======================================================================
create function private.clock() returns timestamptz
language plpgsql stable set search_path = '' as $$
declare v_at timestamptz;
begin
  if to_regclass('private.test_clock') is not null then
    execute 'select at from private.test_clock limit 1' into v_at;
  end if;
  return coalesce(v_at, now());
end $$;

create or replace function private.local_now(p_tz text) returns timestamp
language sql stable set search_path = '' as $$ select private.clock() at time zone p_tz $$;

create or replace function private.week_of(p_tz text) returns date            -- ISO Monday, local
language sql stable set search_path = '' as $$
  select date_trunc('week', private.clock() at time zone p_tz)::date $$;

-- complete_assignment from the game functions, now stamping completed_at from the clock
create or replace function public.complete_assignment(p_assignment uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row public.assignments; v_points smallint; v_new text[];
begin
  v_row := private.lock_my_open_assignment(p_assignment);
  select points into v_points from public.challenges where id = v_row.challenge_id;
  update public.assignments
     set status = 'completed', completed_at = private.clock(), points_awarded = v_points
   where id = v_row.id;
  insert into public.points_ledger (member_id, season_id, week_start, reason, delta, assignment_id)
  values (v_row.member_id, v_row.season_id, v_row.week_start, 'challenge', v_points, v_row.id);
  v_new := private.evaluate_achievements(v_row.member_id, v_row.season_id);
  return jsonb_build_object('points', v_points, 'new_achievements', to_jsonb(v_new));
end $$;

-- ======================================================================
-- achievements (section 9 of the plan)
-- rule.type:
--   total_completed {n}            completed challenges this season
--   category_completed {category,n}
--   all_categories {n}             at least n completed in every category
--   full_weeks {n}                 weeks with all 5 live slots completed
--   streak_weeks {n}               consecutive weeks with >= 3 completed (current run)
--   completed_on {month,day}       a completion on that local date (secret ones)
--   completed_rerolled {n}         completed a reroll replacement
-- ======================================================================
create or replace function private.evaluate_achievements(p_member uuid, p_season uuid) returns text[]
language plpgsql volatile set search_path = '' as $$
declare
  v_tz text; v_ach record; v_ok boolean; v_new text[] := '{}'; v_week date;
begin
  select w.timezone into v_tz from public.members m join public.workplaces w on w.id = m.workplace_id where m.id = p_member;
  for v_ach in
    select a.* from public.achievements a
    where not exists (select 1 from public.member_achievements ma
                      where ma.member_id = p_member and ma.achievement_code = a.code)
  loop
    v_ok := case v_ach.rule ->> 'type'
      when 'total_completed' then
        (select count(*) from public.assignments where member_id = p_member and season_id = p_season and status = 'completed')
          >= (v_ach.rule ->> 'n')::int
      when 'category_completed' then
        (select count(*) from public.assignments a join public.challenges c on c.id = a.challenge_id
          where a.member_id = p_member and a.season_id = p_season and a.status = 'completed'
            and c.category = (v_ach.rule ->> 'category')::public.challenge_category)
          >= (v_ach.rule ->> 'n')::int
      when 'all_categories' then
        (select count(*) from (
           select c.category from public.assignments a join public.challenges c on c.id = a.challenge_id
           where a.member_id = p_member and a.season_id = p_season and a.status = 'completed'
           group by c.category having count(*) >= (v_ach.rule ->> 'n')::int) t) = 5
      when 'full_weeks' then
        (select count(*) from (
           select week_start from public.assignments
           where member_id = p_member and season_id = p_season and status <> 'rerolled'
           group by week_start having count(*) filter (where status = 'completed') = 5) t)
          >= (v_ach.rule ->> 'n')::int
      when 'streak_weeks' then
        private.current_streak(p_member, p_season, private.week_of(v_tz)) >= (v_ach.rule ->> 'n')::int
      when 'completed_on' then
        exists (select 1 from public.assignments
                where member_id = p_member and season_id = p_season and status = 'completed'
                  and extract(month from completed_at at time zone v_tz) = (v_ach.rule ->> 'month')::int
                  and extract(day   from completed_at at time zone v_tz) = (v_ach.rule ->> 'day')::int)
      when 'completed_rerolled' then
        (select count(*) from public.assignments
          where member_id = p_member and season_id = p_season and status = 'completed' and replaces_id is not null)
          >= (v_ach.rule ->> 'n')::int
      else false
    end;
    if v_ok then
      insert into public.member_achievements (member_id, achievement_code) values (p_member, v_ach.code)
      on conflict do nothing;
      if found and v_ach.bonus_points > 0 then
        select week_start into v_week from public.assignments where member_id = p_member order by week_start desc limit 1;
        insert into public.points_ledger (member_id, season_id, week_start, reason, delta, achievement_code)
        values (p_member, p_season, coalesce(v_week, private.week_of(v_tz)), 'achievement', v_ach.bonus_points, v_ach.code)
        on conflict do nothing;
      end if;
      v_new := v_new || v_ach.code;
    end if;
  end loop;
  return v_new;
end $$;

-- Consecutive weeks up to and including p_week with >= 3 completions. A week in progress that
-- has not reached 3 yet does not break the streak; it simply is not counted.
create function private.current_streak(p_member uuid, p_season uuid, p_week date) returns int
language plpgsql stable set search_path = '' as $$
declare v_n int := 0; v_w date := p_week; v_done int;
begin
  loop
    select count(*) into v_done from public.assignments
     where member_id = p_member and season_id = p_season and week_start = v_w and status = 'completed';
    if v_done >= 3 then v_n := v_n + 1;
    elsif v_w <> p_week then exit;
    end if;
    v_w := v_w - 7;
    exit when v_w < (select starts_on from public.seasons where id = p_season);
  end loop;
  return v_n;
end $$;

-- ======================================================================
-- week close (section 8): weekly bonuses, then achievements. Idempotent per workplace + week.
-- ======================================================================
create function private.close_week(p_workplace uuid, p_week date) returns int
language plpgsql volatile set search_path = '' as $$
declare v_m record; v_done int; v_streak int; v_n int := 0;
begin
  insert into public.week_closures (workplace_id, week_start) values (p_workplace, p_week)
  on conflict do nothing;
  if not found then return 0; end if;            -- already closed

  for v_m in
    select distinct a.member_id, a.season_id
    from public.assignments a join public.members m on m.id = a.member_id
    where m.workplace_id = p_workplace and a.week_start = p_week
  loop
    select count(*) into v_done from public.assignments
     where member_id = v_m.member_id and week_start = p_week and status = 'completed';
    if v_done = 5 then
      insert into public.points_ledger (member_id, season_id, week_start, reason, delta)
      values (v_m.member_id, v_m.season_id, p_week, 'full_week', 25) on conflict do nothing;
    end if;
    v_streak := private.current_streak(v_m.member_id, v_m.season_id, p_week);
    if v_done >= 3 and v_streak >= 2 then
      insert into public.points_ledger (member_id, season_id, week_start, reason, delta)
      values (v_m.member_id, v_m.season_id, p_week, 'streak', least(5 * (v_streak - 1), 20))
      on conflict do nothing;
    end if;
    perform private.evaluate_achievements(v_m.member_id, v_m.season_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ======================================================================
-- the one scheduled job (section 10). Runs at minute 5 of every hour; every step is idempotent,
-- so DST changes, a missed run or a season activated mid-week all heal on the next tick.
-- ======================================================================
create function private.hourly_tick() returns void
language plpgsql volatile set search_path = '' as $$
declare v_run bigint; v_wp record; v_m record; v_closed int := 0; v_assigned int := 0; v_week date;
begin
  insert into public.job_runs (job) values ('hourly_tick') returning id into v_run;

  for v_wp in
    select w.id, w.timezone, s.id as season_id, s.starts_on, s.ends_on, s.distribution_hour
    from public.workplaces w join public.seasons s on s.workplace_id = w.id and s.status = 'active'
  loop
    -- 1. close every finished week of the season that is not closed yet
    for v_week in
      select gs::date from generate_series(v_wp.starts_on, least(v_wp.ends_on, private.week_of(v_wp.timezone) - 1), interval '7 days') gs
      where not exists (select 1 from public.week_closures c where c.workplace_id = v_wp.id and c.week_start = gs::date)
    loop
      v_closed := v_closed + private.close_week(v_wp.id, v_week);
    end loop;

    -- 2. Monday distribution, once local time passes distribution_hour
    v_week := private.week_of(v_wp.timezone);
    if v_week between v_wp.starts_on and v_wp.ends_on
       and private.local_now(v_wp.timezone) >= v_week + make_interval(hours => v_wp.distribution_hour) then
      for v_m in
        select m.id from public.members m
        where m.workplace_id = v_wp.id
          and (select count(*) from public.assignments a
               where a.member_id = m.id and a.week_start = v_week and a.status <> 'rerolled') < 5
      loop
        v_assigned := v_assigned + private.assign_week(v_m.id, v_wp.season_id, v_week);
      end loop;
    end if;

    -- 3. finish the season after its last week is closed
    if private.week_of(v_wp.timezone) > v_wp.ends_on then
      update public.seasons set status = 'finished' where id = v_wp.season_id;
    end if;
  end loop;

  update public.job_runs set finished_at = now(), ok = true,
         detail = jsonb_build_object('closed_member_weeks', v_closed, 'slots_assigned', v_assigned)
   where id = v_run;
exception when others then
  -- the insert above is rolled back with the failure; record it in a fresh row
  insert into public.job_runs (job, finished_at, ok, detail)
  values ('hourly_tick', now(), false, jsonb_build_object('error', sqlerrm));
end $$;

-- Daily housekeeping: expired invites, old job logs, and data retention.
-- Retention default: a workplace's game data is deleted 90 days after its last season ended.
create function private.daily_housekeeping() returns void
language plpgsql volatile set search_path = '' as $$
begin
  delete from public.invites where expires_at < private.clock() - interval '7 days';
  delete from public.job_runs where started_at < now() - interval '60 days';
  delete from public.audit_log where at < now() - interval '400 days';
  delete from public.seasons s
   where s.status = 'finished' and s.ends_on < (private.clock() at time zone 'Europe/Oslo')::date - 90;   -- cascades to assignments + ledger
end $$;

create extension if not exists pg_cron;
select cron.schedule('nisse-hourly-tick', '5 * * * *', $$select private.hourly_tick()$$);
select cron.schedule('nisse-daily-housekeeping', '30 2 * * *', $$select private.daily_housekeeping()$$);
