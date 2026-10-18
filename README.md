# Nisseoppdrag

A party game for workplaces: weekly nisse missions, points and a leaderboard. Norwegian house-gnome folklore meets a modern elf workshop.

Stack: React 18, TypeScript (strict), Tailwind v4, Vite, Supabase (PostgreSQL, RLS), Vercel. See `docs/` in the project folder for the plan and decisions (`docs/decisions.md`).

## Layout

- `apps/web` Vite SPA
- `supabase/` CLI config, `migrations/`, `tests/` (pgTAP), `functions/`, `seed.sql`

## Run locally

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker (for Supabase).

```sh
pnpm install
pnpm exec supabase start          # local Postgres + Auth
cp .env.example apps/web/.env.local   # fill in the URL and publishable key printed by `supabase start`
pnpm dev
```

## Checks

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
pnpm build
pnpm e2e                          # Playwright; installs Chromium via `pnpm --filter @nisseoppdrag/web exec playwright install chromium`
pnpm exec supabase test db        # pgTAP, needs `supabase start`/`db start`
```

If a Chromium is preinstalled, point Playwright at it with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`.

## Secrets

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` reach the browser. No service-role key, SMTP password or access token belongs in the repo. Supabase is deliberately not linked to GitHub; migrations reach staging and prod through CI after review.

## Branch protection (Martin applies this once)

Settings → Branches → add a rule for `main`:

- Require a pull request before merging (1 approval)
- Require status checks to pass: `web` and `database`, branch up to date
- Require conversation resolution
- Block force pushes and deletions

Also enable Dependabot alerts and secret scanning (free on public repos). Consider making the repo private.
