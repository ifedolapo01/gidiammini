# scripts/

Ad-hoc helpers. **Schema migrations are not here any more** — they live in
[`supabase/migrations/`](../supabase/migrations/README.md), timestamped and in
dependency order.

- `diagnostics/` — read-only investigation queries, safe to run any time.
  Deliberately kept out of `supabase/migrations/` so `supabase db push` and
  `supabase db reset` never execute them.
- `seed.ts`, `*.js`, `*.py` — one-off local utilities. Still gitignored.
