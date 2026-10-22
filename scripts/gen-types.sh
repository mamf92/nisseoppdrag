#!/usr/bin/env bash
# Regenerates apps/web/src/lib/database.types.ts from the local Supabase database.
# Usage: pnpm gen:types            (needs `supabase db start` or a running local stack)
#        DB_URL=postgresql://... pnpm gen:types   (any Postgres with the migrations applied)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=apps/web/src/lib/database.types.ts
if [ -n "${DB_URL:-}" ]; then target=(--db-url "$DB_URL"); else target=(--local); fi
pnpm exec supabase gen types --lang typescript "${target[@]}" --schema public > "$OUT.tmp"
# The CLI output is unformatted; run it through the repo's Prettier config so diffs are stable.
pnpm exec prettier --stdin-filepath "$OUT" < "$OUT.tmp" > "$OUT"
rm "$OUT.tmp"
