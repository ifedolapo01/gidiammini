# Database migrations

Every schema change lives here, in one ordered, replayable set. Nothing about
the database should exist only in someone's SQL editor history.

## Why the timestamps look synthetic

These migrations were originally loose scripts in `scripts/`, pasted into the
Supabase SQL editor by hand. **Nobody recorded when each one was applied**, so
the filenames can't be a real history. The timestamps instead encode
*dependency order* — the order in which a fresh database must apply them —
derived from each script's own "run this after…" notes and from what each one
references.

Order matters concretely. For example `20251101000700_shipping_zones_geography_and_eta`
adds the `delivery_eta_*` columns that `20251101000900_shipping_zone_exceptions`
mirrors, and `20251101001000_order_change_requests` has a foreign key to
`orders`, so it can't precede the baseline.

From here on, use real timestamps: `supabase migration new <name>`.

## ⚠️ The set is not yet replayable from empty

`20251101000000_baseline_core_tables.sql` is **a placeholder**. The `products`,
`orders` and `order_items` tables were created through the Supabase dashboard,
so their DDL was never written down anywhere in this repo. Until that file holds
a real dump:

- ✅ Production is fine — it already has those tables.
- ❌ `supabase db reset`, a fresh local database, and any staging environment
  will fail on the first `ALTER TABLE public.products`.

Instructions for completing it are in the file's own header.

## Adopting the CLI against the existing production database

All 18 real migrations here have **already been applied to production** by hand.
Do not run `supabase db push` before telling the CLI that — it would try to
re-apply everything.

```bash
# 1. Link the repo to the project (asks for the database password)
npx supabase link --project-ref <your-project-ref>

# 2. See what the CLI thinks has been applied (expect: all remote-only or none)
npx supabase migration list

# 3. Mark every already-applied migration as applied, WITHOUT running it
npx supabase migration repair --status applied 20251101000100
npx supabase migration repair --status applied 20251101000200
# … repeat for each version below, in order …
npx supabase migration repair --status applied 20251101001800

# 4. Confirm local and remote now agree
npx supabase migration list
```

Leave `20251101000000` (the baseline) unrepaired until it contains real DDL.

After that, the normal loop is:

```bash
npx supabase migration new add_something   # creates a timestamped file
# …edit it…
npx supabase db push                       # applies only what's pending
npm run db:types                           # regenerate TypeScript types
```

## What is applied where

| Version | What it does | Applied to production |
|---|---|---|
| `20251101000000` | **baseline: products, orders, order_items** | pre-existing (created by hand) — **file still empty** |
| `20251101000100` | categories, subcategories, discounts; products.sub_category + pricing_config | yes |
| `20251101000200` | products.sizing_type | yes |
| `20251101000300` | discounts.notified_phases | yes |
| `20251101000400` | discounts scope allows `VARIANT` | yes |
| `20251101000500` | subscribers | yes |
| `20251101000600` | shipping_zones; orders.shipping_zone_id | yes |
| `20251101000700` | shipping zones: state/LGA/places, is_primary, structured ETA | yes |
| `20251101000800` | shipping_zones.is_door_delivery | yes |
| `20251101000900` | shipping_zone_exceptions | yes |
| `20251101001000` | order_change_requests | yes |
| `20251101001100` | order_change_requests allows `cancel` | yes |
| `20251101001200` | order_status_history (+ backfill) | yes |
| `20251101001300` | orders.payment_reminder_sent_at | yes |
| `20251101001400` | one-off stock reconciliation — **superseded** by `…001600` step 4 | yes |
| `20251101001500` | stock reservation: orders.stock_reserved/reserved_until, `adjust_order_stock()` | yes |
| `20251101001600` | drops the duplicate stock trigger, makes negative stock raise, repairs drift | yes |
| `20251101001700` | RLS lock-down: anon loses read access to the order tables | yes |
| `20251101001800` | receipts bucket private; orders.receipt_url → receipt_path | yes |

## Verified replay order

The 18 real migrations have been replayed onto an empty PostgreSQL 17 database,
in filename order, and all 18 applied cleanly — producing exactly the schema the
application expects (all 7 added `orders` columns, all 3 added `products`
columns, 11 tables, and only the two stock functions that should still exist).

Two dependencies a bare Postgres doesn't have, which a real Supabase database
does:

- `20251101000500_subscribers.sql` uses `auth.role()`, so it needs the `auth`
  schema. (That policy is dropped again by `…001700` anyway.)
- `20251101001800_private_receipts.sql` reads and writes `storage.buckets` /
  `storage.objects`.

## Conventions

- **Idempotent where practical** — `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP … IF EXISTS`. Several of these have been run more than once.
- **Explain the why in a header comment.** The existing files do this well and
  it is the main reason the original order could be reconstructed at all.
- **Data repairs are migrations too** (e.g. `…001400`, `…001600` step 4), so a
  rebuilt environment ends up in the same state.
- **Diagnostics are not migrations.** Read-only investigation queries live in
  `scripts/diagnostics/` so `db push` and `db reset` never execute them.
