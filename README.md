# Nisseoppdrag · Nisse Missions

> **På norsk:** Nisseoppdrag er et julespill for arbeidsplassen. Hver mandag i adventstiden får alle fem små oppdrag, ett i hver kategori: sosialt, vennlighet, læring, samarbeid og julemoro. Gjør oppdragene, samle poeng og merker, og klatre på listen over toppnissene. Nissen ser alt, men lagrer nesten ingenting: du logger inn med en engangskode på e-post og spiller under et selvvalgt nissenavn.

A Christmas party game for workplaces. Every Monday in the season each player gets five small missions, one per category (social, kindness, learning, collaboration and holiday fun). Complete them to earn points and badges and climb the leaderboard. The look is Norwegian house-gnome folklore first: the _nisse_ who guards the farm, wants his Christmas porridge with butter on top, and turns grumpy if he is forgotten.

**Status:** early development. The repo, tooling and CI are in place (work package 0); the database, game logic and UI are being built package by package. There is no public instance yet.

## Why this exists

Nisseoppdrag is a side project by Martin ([@mamf92](https://github.com/mamf92)). The game is real and meant to be played at work, but the project is just as much an experiment:

- **How far can AI take a project?** Planning, architecture, database security, UI, illustrations and copy are produced with AI agents, with a human making the calls and reviewing the result.
- **Combining different models and tools.** Claude (Claude Code) plans, writes the code and runs the threads of work; ChatGPT generates the paintings from prompt packs written for it; Codex reviews pull requests. Each tool does what it is best at.
- **Automating the development process.** Work is split into small work packages, each delivered as one pull request with green CI. Decisions are logged as they are made, so a fresh agent (or person) can pick up where the last one stopped.

Expect commit messages, PR descriptions and comments that were written by agents. They are reviewed before they reach `main`.

## How the game works

- **One workplace per player.** An admin creates the workplace and hands out invite codes. Players join with an email code and pick a nisse name such as _Grøtnissa_ or _Bjelletufsen_. No real names.
- **Five missions a week.** Missions are drawn from the workplace's own catalogue, one per category, every Monday at 06:00 (Europe/Oslo). The week closes Sunday 23:59.
- **Points.** 10, 20 or 30 per mission by difficulty, +25 for a full week, a streak bonus for consecutive weeks, and badge bonuses. Points live in an append-only ledger, so nothing can be paid twice.
- **One skip and one reroll per week.** Skipping gives no points and forfeits the full-week bonus. Rerolling ("Rist sekken", shake the sack) swaps a mission for another in the same category.
- **Badges.** Fifteen painted medallions, some of them secret until unlocked.
- **Nissefars kontor.** The admin area (`/kontor`): catalogue, season dates, invites, roles, audited point adjustments. Admins see aggregates and the leaderboard, never a per-person activity log.

Every game action (complete, skip, reroll, payouts) is validated in the database, not in the browser.

## Two themes, two stories

Both themes share components, rules and the badge medallions, but each tells its own story through its paintings and its five weekly "hatches" (luker).

|                   | Låven (dark)                                                                                      | Gården (light)                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Story             | **«Grøt til nissen!»** Gather what the lonely fjøsnisse needs for his Christmas porridge          | **«Full låve!»** Bring the nisse family home to the barn for Christmas |
| Mood              | Quiet, mysterious winter nights, inspired by Theodor Kittelsen. You mostly see the nisse's traces | Warm, together, a 1900s Christmas postcard on cream paper              |
| Each hatch brings | Milk, butter, cinnamon, rice, bowl and spoon                                                      | Lyktenissen, Grøtnissa, Nissefar, Snønissen, Låvenissen                |
| Five of five      | The porridge on the barn bridge                                                                   | The hayloft feast                                                      |

The theme is chosen by the player and stored in the browser only. Icons are a custom chip-carving set ("Karveskurd"); type is Fraunces and Alegreya Sans, self-hosted.

## Privacy by design

The rule for this project is to collect as little as possible.

- The only personal data is the email address Supabase Auth needs to send a login code. No passwords, no social login.
- Players appear under a nisse name they choose. Nothing is derived from the email.
- No analytics, trackers, third-party scripts, CDNs or remote fonts. The Content Security Policy only allows the app itself and Supabase.
- Theme and language preferences stay in `localStorage`.
- Season data is deleted 90 days after the season ends. Players can delete their account themselves, which removes all their rows.

## Architecture

| Part     | Choice                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Vite, React 18, TypeScript (strict), React Router, TanStack Query, Tailwind v4. A static SPA, so there is no server runtime to secure                |
| Backend  | Supabase: PostgreSQL with Row Level Security on every table, email OTP auth, `pg_cron` for the weekly schedule, one Edge Function (account deletion) |
| Hosting  | Vercel, region `arn1` (Stockholm). Supabase staging and production run in separate EU projects                                                       |
| Tests    | Vitest and Testing Library, Playwright end to end, pgTAP for the database                                                                            |

Security choices, kept deliberately boring:

- **Default deny.** Clients get no `INSERT`, `UPDATE` or `DELETE` on game tables. Every write goes through a `security definer` RPC with `set search_path = ''`, and `execute` is revoked from `public` and granted per function.
- **Rules the database enforces.** Partial unique indexes guarantee one skip and one reroll per player per week, and one payout per reason, even if a function has a bug.
- **Least privilege.** The browser only ever sees the Supabase URL and the publishable key. The service-role key exists only inside the account-deletion Edge Function.
- **Reviewed migrations.** Supabase is not linked to GitHub; migrations reach staging and production through CI after review.
- **Security headers** (CSP, HSTS, `nosniff`, `no-referrer`, a restrictive `Permissions-Policy`) are set in [`apps/web/vercel.json`](apps/web/vercel.json).

## Repository layout

```
apps/web/          Vite SPA (src/, e2e/, vercel.json)
supabase/          CLI config, migrations/, tests/ (pgTAP), functions/, seed.sql
art/               Inbox for generated illustrations, with the prompts per round
.github/           CI workflow and Dependabot
```

## Run locally

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker (for Supabase).

```sh
pnpm install
pnpm exec supabase start              # local Postgres + Auth
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

CI runs the same on every pull request in two jobs, `web` and `database`.

## Secrets

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` reach the browser. No service-role key, SMTP password or access token belongs in the repo. Supabase is deliberately not linked to GitHub; migrations reach staging and prod through CI after review.

## Deployment and release flow

Two long-lived branches, two environments:

| Branch    | Vercel                        | Supabase        | URL                                          |
| --------- | ----------------------------- | --------------- | -------------------------------------------- |
| `staging` | Preview (a stable branch URL) | staging project | `nisseoppdrag-git-staging-<team>.vercel.app` |
| `main`    | Production                    | prod project    | nisseoppdrag.no                              |

1. Work happens on a feature branch and goes into `staging` by pull request (`web` and `database` must pass).
2. Test on the staging URL. Migrations are applied to the staging project first.
3. When the functionality is verified, open a pull request from `staging` to `main`. Merging it deploys Production, and the same migrations are then applied to prod.

Other branches and PRs still get their own Vercel Preview, which also uses the staging project.

Vercel settings: Root Directory `apps/web`, framework Vite, other commands left to `apps/web/vercel.json`. Environment variables (public values only): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, with the prod project on Production and the staging project on Preview. Vite bakes the values into the build, so redeploy after changing them. Until prod is ready, Production may point at the staging project too.

## Branch protection

`main` is protected by a GitHub ruleset (apply the same to `staging`): pull request required (0 approvals), status checks `web` and `database`, no force pushes, no deletion. Also enable Dependabot alerts and secret scanning. Consider making the repo private.

## How work is organised

- The project is built in twelve work packages (WP0 to WP11): repo and CI, schema, RLS and game functions, scheduling and badges, UI kit, auth, player home, leaderboard and profile, admin, starter catalogue, deployment, and launch hardening.
- Each package is one pull request that must pass `web` and `database` before it can merge.
- Every non-trivial decision is logged with its reason and who made it, and changed by adding a new entry rather than editing an old one.
- App copy is written in Norwegian (bokmål) first, with English as the second language.

## Art

The paintings are generated in ChatGPT from prompt packs written for this project, using our own character sheets and public-domain references only. New images arrive through [`art/`](art/README.md). OpenAI's terms allow commercial use of generated images.

## Security

Found a vulnerability? Please report it privately through GitHub's [private vulnerability reporting](https://github.com/mamf92/nisseoppdrag/security/advisories/new) instead of opening a public issue.

## License

The code is intended to be released under the MIT licence; the illustrations will be licensed separately. A `LICENSE` file will be added before launch.
