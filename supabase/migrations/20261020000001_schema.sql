-- Nisseoppdrag: schema (draft reference migration, owned by WP1)
-- Target: Supabase Postgres 15+, region eu-north-1.
-- Rule: the only personal data is auth.users.email (managed by Supabase Auth).
-- Nothing here copies the email; players appear under a self-chosen nisse_name.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;          -- internal helpers, not exposed by PostgREST
revoke all on schema private from public, anon, authenticated;

-- ---------- enums ----------
create type public.challenge_category as enum
  ('social', 'kindness', 'learning', 'collaboration', 'holiday_fun');
create type public.member_role as enum ('player', 'admin');
create type public.assignment_status as enum ('open', 'completed', 'skipped', 'rerolled');
create type public.ledger_reason as enum
  ('challenge', 'full_week', 'streak', 'achievement', 'admin_adjustment');
create type public.season_status as enum ('draft', 'active', 'finished');

-- ---------- platform ----------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------- workplaces & members ----------
create table public.workplaces (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 2 and 60),
  slug                  text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  timezone              text not null default 'Europe/Oslo',
  allowed_email_domains text[] not null default '{}',   -- optional extra gate on invite redemption
  created_at            timestamptz not null default now()
);

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  user_id      uuid not null unique references auth.users (id) on delete cascade, -- MVP: one workplace per user
  role         public.member_role not null default 'player',
  nisse_name   text not null check (char_length(nisse_name) between 2 and 32
                                    and nisse_name !~ '[<>@]'),
  avatar       jsonb not null default '{}'::jsonb
               check (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 512),
  joined_at    timestamptz not null default now(),
  unique (workplace_id, nisse_name)
);
create index on public.members (workplace_id);

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  code_hash    bytea not null unique,             -- sha256 of the code; plaintext shown once
  role         public.member_role not null default 'player',
  expires_at   timestamptz not null,
  max_uses     int not null default 500 check (max_uses between 1 and 5000),
  uses         int not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- seasons ----------
create table public.seasons (
  id                uuid primary key default gen_random_uuid(),
  workplace_id      uuid not null references public.workplaces (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 60),
  starts_on         date not null check (extract(isodow from starts_on) = 1),  -- a Monday
  ends_on           date not null check (extract(isodow from ends_on) = 7),    -- a Sunday
  distribution_hour smallint not null default 6 check (distribution_hour between 0 and 23),
  status            public.season_status not null default 'draft',
  created_at        timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index one_active_season_per_workplace
  on public.seasons (workplace_id) where status = 'active';

-- ---------- challenges ----------
create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  category     public.challenge_category not null,
  title_nb     text not null check (char_length(title_nb) between 3 and 80),
  title_en     text not null check (char_length(title_en) between 3 and 80),
  body_nb      text not null default '' check (char_length(body_nb) <= 400),
  body_en      text not null default '' check (char_length(body_en) <= 400),
  difficulty   smallint not null default 1 check (difficulty between 1 and 3),
  points       smallint not null default 10 check (points between 5 and 50),
  is_active    boolean not null default true,
  archived_at  timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.challenges (workplace_id, category) where is_active and archived_at is null;

-- ---------- weekly assignments ----------
create table public.assignments (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members (id) on delete cascade,
  season_id      uuid not null references public.seasons (id) on delete cascade,
  week_start     date not null check (extract(isodow from week_start) = 1),
  slot           smallint not null check (slot between 1 and 5),
  challenge_id   uuid not null references public.challenges (id) on delete restrict,
  status         public.assignment_status not null default 'open',
  points_awarded smallint not null default 0,
  completed_at   timestamptz,
  replaces_id    uuid references public.assignments (id) on delete set null, -- set on a reroll replacement
  created_at     timestamptz not null default now(),
  unique (member_id, week_start, challenge_id)
);
-- one live challenge per slot
create unique index one_live_per_slot on public.assignments (member_id, week_start, slot)
  where status <> 'rerolled';
-- token rules enforced by the database itself: max 1 skip and max 1 reroll per week
create unique index one_skip_per_week on public.assignments (member_id, week_start)
  where status = 'skipped';
create unique index one_reroll_per_week on public.assignments (member_id, week_start)
  where status = 'rerolled';
create index on public.assignments (season_id, week_start);

-- ---------- points ----------
create table public.points_ledger (
  id               bigint generated always as identity primary key,
  member_id        uuid not null references public.members (id) on delete cascade,
  season_id        uuid not null references public.seasons (id) on delete cascade,
  week_start       date not null,
  reason           public.ledger_reason not null,
  delta            int not null check (delta between -500 and 500),
  assignment_id    uuid references public.assignments (id) on delete cascade,
  achievement_code text,
  note             text check (char_length(note) <= 120),   -- admin adjustments only
  created_at       timestamptz not null default now()
);
create unique index ledger_once_per_assignment on public.points_ledger (assignment_id)
  where reason = 'challenge';
create unique index ledger_once_per_week_bonus on public.points_ledger (member_id, week_start, reason)
  where reason in ('full_week', 'streak');
create unique index ledger_once_per_achievement on public.points_ledger (member_id, achievement_code)
  where reason = 'achievement';
create index on public.points_ledger (season_id, week_start);

-- ---------- achievements ----------
create table public.achievements (
  code           text primary key check (code ~ '^[a-z0-9_]{3,40}$'),
  name_nb        text not null,
  name_en        text not null,
  description_nb text not null,
  description_en text not null,
  icon           text not null,          -- icon key in the front-end sprite
  bonus_points   smallint not null default 0 check (bonus_points between 0 and 100),
  rule           jsonb not null,         -- see private.evaluate_achievements
  is_secret      boolean not null default false,
  sort           smallint not null default 0
);

create table public.member_achievements (
  member_id        uuid not null references public.members (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  unlocked_at      timestamptz not null default now(),
  primary key (member_id, achievement_code)
);

-- ---------- operations ----------
create table public.week_closures (
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  week_start   date not null,
  closed_at    timestamptz not null default now(),
  primary key (workplace_id, week_start)
);

create table public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  detail      jsonb not null default '{}'::jsonb   -- counts only, never user identifiers
);

create table public.audit_log (
  id           bigint generated always as identity primary key,
  workplace_id uuid references public.workplaces (id) on delete cascade,
  actor        uuid references auth.users (id) on delete set null,
  action       text not null,
  target       text,
  at           timestamptz not null default now()
);

-- updated_at trigger for challenges
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger challenges_touch before update on public.challenges
  for each row execute function private.touch_updated_at();
