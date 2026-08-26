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

## Verified: the set rebuilds the database from empty

`20251101000000_baseline_core_tables.sql` holds the real definitions of
`products`, `orders` and `order_items`, read out of the live database (those
three were originally created by hand in the dashboard, which is why no file
defined them).

All 20 migrations have been replayed, in filename order, onto an empty
PostgreSQL 17 database given nothing but the schemas hosted Supabase provides
(`auth`, `storage`, and the anon/authenticated/service_role roles). Result:

- all 20 applied cleanly
- **49 columns across the three core tables — identical to production, with
  nothing missing and nothing extra**
- 11 tables, the `prevent_negative_stock` trigger present, `adjust_order_stock`
  and `check_stock_trigger` present, the deleted stock functions absent
- `anon` has no grants on `orders`, and the receipts bucket is private
- `orders_reservation_sweep_idx` exists exactly once (created by `…001500`, not
  duplicated in the baseline)

Two dependencies a bare PostgreSQL doesn't have, which a real Supabase database
does:

- `…000500_subscribers.sql` uses `auth.role()`, so it needs the `auth` schema.
  (That policy is dropped again by `…001700` anyway.)
- `…001800_private_receipts.sql` reads and writes `storage.buckets` /
  `storage.objects`.

The baseline's `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` is a no-op on
Supabase, which pre-installs it in the `extensions` schema; on a plain
PostgreSQL it installs into `public`. Either way the unqualified
`uuid_generate_v4()` in the column defaults resolves.

## Never run `db push` before the ledger is in sync

This already bit once. The repair step had not been done, so `db push` offered
to apply all 22 migrations and replayed history against a database years past
it. It failed at `20251101000600`, whose seed INSERT names the `delivery_eta`
column that `000700` later drops:

```
ERROR: column "delivery_eta" of relation "shipping_zones" does not exist
```

No data was lost, but two things came close:

- `000500` recreated the public-insert policy on `subscribers`. It stayed
  inaccessible only because `001700` also does `REVOKE ALL` — with the grant
  gone, the policy is unreachable. Defence in depth is the only reason that
  wasn't a regression.
- `001200`'s backfill was not idempotent and would have duplicated every
  order's status history. It survived purely because the push died first. It is
  now guarded with `NOT EXISTS`.

**The ledger is now in sync** (all 22 applied), so `db push` is safe from here.
It applies only genuinely-pending migrations. The adoption dance below is kept
as a record of what was done, in case it is ever needed for another
environment.

<details>
<summary>One-time adoption for an existing database (already done here)</summary>

```bash
npx supabase login
npm run db:link -- <project-ref>
npm run db:status                    # see what the remote has recorded

# Mark each already-applied migration WITHOUT running it, oldest first:
npx --yes supabase migration repair --status applied <version>
# ...one line per version...

npm run db:status                    # confirm both sides agree
npm run db:push                      # applies only what is genuinely pending
npm run db:types                     # regenerate types/database.ts
```

Run `link` on its own line. Its password prompt will otherwise swallow the
next line of a pasted block, which is how the link silently failed here.

</details>

## Migrations that must never be replayed out of order

Marked with a warning in their own headers too:

| Version | Why |
|---|---|
| `20251101000600` | Seeds the free-text `delivery_eta` column that `000700` drops — replaying it errors. |
| `20251101000700` | Its UPDATEs reset every zone's ETA to the original hardcoded defaults and force `is_primary` on Abuja, discarding whatever the admin has configured since. |

Both are correct in sequence on a fresh database. Being marked applied is what
keeps them from running again.

## What is applied where

| Version | What it does | Applied to production |
|---|---|---|
| `20251101000000` | baseline: products, orders, order_items | pre-existing (created by hand) |
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
| `20251101001900` | recreates the `prevent_negative_stock` trigger, which was in no migration | pre-existing (created by hand) |
| `20251101002000` | NOT NULL on orders.status/payment_verified, products.stock/is_active | yes |
| `20251101002100` | locks down the orphaned `public.users` table (anon could read `password_hash`) | **not yet — push this** |

## Conventions

- **Idempotent where practical** — `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP … IF EXISTS`. Several of these have been run more than once.
- **Explain the why in a header comment.** The existing files do this well and
  it is the main reason the original order could be reconstructed at all.
- **Data repairs are migrations too** (e.g. `…001400`, `…001600` step 4), so a
  rebuilt environment ends up in the same state.
- **Diagnostics are not migrations.** Read-only investigation queries live in
  `scripts/diagnostics/` so `db push` and `db reset` never execute them.
