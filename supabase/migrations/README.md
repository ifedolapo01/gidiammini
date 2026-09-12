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

All 25 migrations have been replayed, in filename order, onto an empty
PostgreSQL 17 database given nothing but the schemas hosted Supabase provides
(`auth`, `storage`, and the anon/authenticated/service_role roles). Result:

- all 25 applied cleanly
- **13 tables and 50 columns across the three core tables** — matching
  production, with nothing missing and nothing extra
- exactly one trigger (`prevent_negative_stock`) and seven functions
  (`adjust_order_stock`, `check_rate_limit`, `check_stock_trigger`,
  `prune_rate_limits`, `reserve_order_number`, `reset_rate_limit`,
  `set_variant_stock`); the superseded stock functions are absent
- `anon` has no grants on `orders`, and the receipts bucket is private
- `orders_reservation_sweep_idx` exists exactly once (created by `…001500`, not
  duplicated in the baseline)

Re-run that check after any schema change — it is the only thing that proves a
fresh or staging database can be built from this directory alone.

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

## `db push` cannot use the direct connection from here

Supabase made the direct database host (`db.<ref>.supabase.co`) **IPv6-only** —
IPv4 on it is a paid add-on. This machine's network hands out an IPv6 address
but routes nothing over it, so the CLI's default connection dies with:

```
failed to connect to postgres: failed to connect to `host=db.<ref>.supabase.co ...`:
Connection terminated unexpectedly
```

which reads like a database fault and is a network one. Confirmed by:
`nslookup db.<ref>.supabase.co` returns an AAAA record and no A record,
`ipv6.google.com:443` is unreachable, and TCP 5432 to
`aws-1-eu-north-1.pooler.supabase.com` succeeds.

**So use the pooler.** `npm run db:push` and `npm run db:status` both wrap the
CLI with `--db-url` pointing at `SUPABASE_DB_URL` from `.env.local` — the
**Session pooler** string from Project → Connect (port **5432**; the 6543
transaction pooler cannot run migrations). `scripts/db-url.mjs` refuses both of
the wrong strings by name, because each otherwise fails with something that
does not say what is wrong: the direct host times out, and the transaction
pooler connects and then refuses the migration. The password never reaches a
command line or shell history.

`npm run db:push:direct` is the unwrapped CLI, kept for a network that does
have working IPv6.

`db:types` is unaffected either way: `gen types --linked` reads the schema over
HTTPS from the Management API and never opens a Postgres connection. A
successful `db:types` therefore says nothing about whether `db push` can
connect — which is exactly how a database can end up with tables the ledger
does not list.

## Never run `db push` before the ledger is in sync

This already bit once. The repair step had not been done, so `db push` offered
to apply every migration in the directory (22 of them at the time) and replayed
history against a database long past it. It failed at `20251101000600`, whose
seed INSERT names the `delivery_eta` column that `000700` later drops:

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

**The ledger is in sync**, so `db push` is safe from here. Run
`npm run db:status` before a push anyway: `db:types` succeeding proves nothing
about it, because `gen types --linked` reads the schema over HTTPS and never
opens a Postgres connection — a database can hold tables the ledger does not
list.
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
| `20251101002100` | locks down the orphaned `public.users` table (anon could read `password_hash`) | yes |
| `20251101002200` | `rate_limits` table + `check_rate_limit` / `reset_rate_limit` / `prune_rate_limits` | yes |
| `20251101002300` | server-issued order numbers (`order_number_seq`, `reserve_order_number`) and `orders.idempotency_key` | yes |
| `20251101002400` | `set_variant_stock()` — makes the admin Stock page's save atomic | yes |
| `20251101002500` | `customers` table + `orders.customer_id` + `customer_stats` view + `normalise_ng_msisdn()` | yes |
| `20251101002600` | `product_variants` table, backfill, derived `products.stock`, relational stock RPCs, `order_items.variant_id` | yes |
| `20251101002700` | `audit_log` (append-only) + `prune_audit_log()` | yes |
| `20251101002800` | product search: `products.search_vector` + GIN index + `search_products()` + `search_queries` log | yes |
| `20251101002900` | product faceting: `product_sales` view + `list_products()` + `product_facet_options()` | yes |
| `20251101003000` | listing keyset paging: `product_candidates()` + `count_products()` + a card-sized `list_products()` | yes |
| `20251101003100` | `stock_alerts` table; sold-out products listed and ranked last; facet options no longer stock-filtered | yes |
| `20251101003200` | recommendations: `product_pairs` + `rebuild_product_pairs()` + `product_cards()` + related/co-purchase id functions | yes |
| `20251101003300` | reviews: `product_reviews` + `order_review_invites` + `product_review_stats` view + public `review-photos` bucket | yes |
| `20251101003400` | Q&A: `product_questions` (question + answer in one table) | yes |
| `20251101003500` | size guides: `categories.size_guidance`, `products.fit_rating`/`fit_note`, `sizing_type` allows `maternity` | yes |
| `20251101003600` | customer accounts: `customer_auth_tokens` + `customer_sessions` + `prune_customer_auth()` | **not yet — pending `db push`** |
| `20251101003700` | `customer_wishlist` — a wishlist that follows the customer | **not yet — pending `db push`** |
| `20251101003800` | online payments: `orders.payment_method`/`payment_reference`/`paid_at`/`payment_channel` | **not yet — pending `db push`** |
| `20251101003900` | `payment_events` — the provider's own messages, and what was done about each | **not yet — pending `db push`** |
| `20251101004000` | `abandoned_carts` — the basket last seen for an email that did not order | **not yet — pending `db push`** |
| `20260905190000` | orders gain the money breakdown behind `total_amount` | **not yet — pending `db push`** |
| `20260905190100` | `edit_order_items()` — an order's lines stop being write-once | **not yet — pending `db push`** |
| `20260905190200` | `order_refunds`, and `orders.amount_refunded` | **not yet — pending `db push`** |
| `20260905190300` | cancellation reason codes, and the `order_cancellations` view | **not yet — pending `db push`** |
| `20260905190400` | courier, waybill and tracking link on orders | **not yet — pending `db push`** |
| `20260905190500` | `customers.tags`, `customer_addresses`, refund-aware `customer_stats` | **not yet — pending `db push`** |
| `20260910120000` | `subsubcategories` table; `products.sub_sub_category`; `product_candidates`/`count_products`/`list_products`/`product_facet_options` gain `p_subsubcategory`; discounts scope allows `SUBSUBCATEGORY` | **not yet — pending `db push`** |
| `20260910130000` | every money column becomes `bigint` minor units; `store_settings.currency` + `orders.currency` | **not yet — pending `db push`** |
| `20260911100000` | `stores`; `current_store_id()`; `store_id` on every root table; `app_service` role + RLS scoping | **not yet — pending `db push`** |
| `20260912100000` | reassigns the SECURITY DEFINER product/order/return functions to `app_service`, so RLS applies inside them too | **not yet — pending `db push`** |
| `20260912110000` | `product_attributes` + `product_attribute_values`; `product_variants.attributes`; size/color become generated columns, `variant_key` becomes trigger-maintained; `create_product_attribute()` | **not yet — pending `db push`** |

The rows between `20251101004000` and `20260905190000` predate this table being
kept up to date; `npm run db:status` is the authority on what the remote has
actually recorded.

### Failed first push: `uuid_generate_v4()`

The first `db push` of this migration failed at the first statement with
`ERROR: function uuid_generate_v4() does not exist (SQLSTATE 42883)`. Nothing
was applied and no repair was needed.

The default was copied from the baseline, which calls `uuid_generate_v4()` from
uuid-ossp. That resolves on a local rebuild because the baseline runs
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, which installs it into `public`.
On hosted Supabase the extension already lives in the `extensions` schema, so
the `CREATE EXTENSION` is a no-op and the bare function name is not on the
search_path `db push` uses.

Use `gen_random_uuid()` — core Postgres since 13, no extension — as every other
migration here already did. `lib/commerce/migration-conventions.test.ts` now
fails the suite if any migration (the baseline excepted) calls
`uuid_generate_v4` or another unqualified `extensions` function.

## Recommendations (`20251101003200`)

There was no recommendation surface anywhere, so every session was
single-product and average order value stayed at one item — expensive when
delivery is charged per order, because bundling is the only way the shop and
the customer both win on shipping.

Two heuristics and one piece of the shopper's own history, no modelling:

- **`related_product_ids()`** — same subcategory first, widening to the
  category. Sold-out products rank last rather than being excluded; on a
  catalogue this size dropping them can leave the rail empty.
- **`co_purchased_product_ids()`** — real co-purchases from `product_pairs`.
  Here sold-out *is* excluded, and so is anything already in the cart: the
  entire point of a cart cross-sell is adding it to this order.
- **Recently viewed** — localStorage plus one `product_cards()` lookup. Not a
  recommendation at all, just the shopper's own history handed back.

### `product_cards()` is the only card projection

The three surfaces return **ids and a rank**; the card shape is looked up once.
Repeating the column list per surface would be three things to keep in step with
ProductCard, and eventually one of them would not be. Input order survives via
`WITH ORDINALITY`, because the ranking is the caller's and an unordered result
would discard it.

### `product_pairs`

Directed — both `(a → b)` and `(b → a)` are stored, so a lookup is an index seek
rather than an OR across two columns. Counts are `count(DISTINCT order_id)`, not
item rows: an order that listed the same product twice is one piece of evidence.
Only non-pending, non-cancelled orders count, mirroring `REVENUE_STATUSES` —
otherwise anyone could seed the recommendations by placing orders they never pay
for.

`rebuild_product_pairs()` is a **full recompute**, run nightly by
`/api/cron/product-pairs` at 04:00. An incremental version would need to
remember which orders it had already counted, and that state eventually
disagrees with reality. It uses `DELETE` rather than `TRUNCATE` so it stays
inside the caller's transaction instead of taking an ACCESS EXCLUSIVE lock that
blocks every reader for the length of the rebuild.

`p_min_orders` defaults to 1. On a catalogue this size a single shared order is
the only signal there is; raise it once the order book is large enough that
pairs start looking like coincidence.

The table is derived from the order tables and inherits their access rules — RLS
on, no grant to `anon` or `authenticated`, reachable only through the SECURITY
DEFINER function.

## Sold-out products and stock alerts (`20251101003100`)

The listing applied `stock > 0`, so a sold-out product left the catalogue
entirely — losing its indexed page and whatever ranking it had earned, losing
the demand signal, and hiding the out-of-stock UI that already existed on the
product page from almost everyone who might have reached it.

`p_in_stock` becomes **`p_in_stock_only`, defaulting FALSE**. Renamed as well as
re-defaulted, deliberately: a caller still passing the old argument now fails
loudly instead of quietly meaning the opposite of what it used to.

Sold-out products rank **last under every sort**, which makes `is_sold_out` the
outermost sort key — and therefore part of the keyset cursor. It sorts ASC while
most sort keys run DESC, and a row-value comparison needs one direction
throughout, so the cursor predicate is two-level: *in a later block*, or *same
block and past the key*. A cursor minted before this migration carries no block
and is read as in-stock, which is where every one of them pointed.

`product_facet_options()` is recreated here for the same reason. It built its
option lists from `p.stock > 0`, which was correct while sold-out products were
hidden. Left alone, a size whose every product had sold out would vanish from
the sidebar while its products stayed in the grid — the filter rail quietly
disagreeing with the listing beside it.

### `stock_alerts`

One row per person per product they are waiting for. A partial unique index on
`(product_id, lower(email)) WHERE notified_at IS NULL` means asking twice while
waiting is one request rather than two emails, while a spent row leaves the same
person free to ask again next time it sells out.

The table pairs an email address with what that person wants to buy, so RLS is
on, every policy is dropped, and `anon`/`authenticated` have no grant of any
kind. Everything that touches it runs server-side under the service role.

The email format is checked by a CHECK constraint as well as by the API — a row
arriving through any other route still has to be mailable.

### The restock flow

`lib/commerce/stock-alerts.ts` drains the queue from the admin stock save. Three
rules:

1. **Only a 0 → positive transition fires** (`isRestock` in `stock.ts`, tested).
   Editing 4 to 6 restocks nothing that was unavailable, and mailing on it would
   train people to ignore the mail. The check is against the *product* total,
   not the variant — a variant going 0 → 5 while a sibling still had stock is
   not a restock.
2. **Rows are claimed before they are sent.** The claim is a conditional
   `UPDATE ... WHERE notified_at IS NULL` returning the rows it changed, so two
   concurrent saves cannot both pick up the same alert. A crash mid-send leaves
   some people unmailed, which is a far better failure than an unclaimed queue
   that mails everyone twice on the next save.
3. **Nothing there can fail the save.** The stock change is the admin's
   instruction and has already committed; a mail server being down must not turn
   that into an error they retry.

## Listing keyset paging (`20251101003000`)

Replaces `list_products()` — the return type changes, so the old overloads are
dropped by name first, which is also why this could not be an edit to
`…002900`.

**Card-sized rows.** The old function returned every product column.
`description`, `images`, `colors`, `sizes`, `details` and the whole
`pricing_config` JSONB travelled to the browser for a card that draws six
fields, and `description` itself is clamped to two lines by CSS after arriving
in full. It now returns only what ProductCard renders, with the description cut
to 200 characters and the variant price range precomputed as
`price_min`/`price_max` — which is the only thing `pricing_config` was ever
unpacked in the browser to produce.

**Keyset, not OFFSET.** `OFFSET 240` makes Postgres walk and discard 240 rows,
so page 10 costs ten pages of work; and if a product is added mid-browse, every
subsequent page shifts and the shopper sees a duplicate or misses one. The
cursor is `(sort key, id)` and each sort's tiebreaker runs in the same direction
as its key, so the comparison stays a single row-value range.

The cursor is spread across **typed** parameters — `p_cursor_price`,
`p_cursor_sold`, `p_cursor_name`, `p_cursor_created` — rather than one text
value cast per sort. A `p_cursor::integer` inside a `CASE` can be constant-folded
by the planner even when its branch is not taken, so sorting by name with a
name-shaped cursor would fail trying to read `'Baby Gown'` as an integer.

**`product_candidates()` is the single definition of what matches.** Both
`list_products()` and `count_products()` build on it. The alternative — the same
WHERE clause written twice — is two things that must stay identical and
eventually will not.

**`units_sold` is not returned.** It is needed to page a best-selling sort, but
it is also a public statement of how much the store sells. The row carries an
opaque `sort_value`, `/api/products` turns that into a base64 cursor, and it
never reaches the browser.

Counting is separate and runs only for the first page; every "Load more" after
it already knows the total and asks for rows alone.

### Caching

`lib/commerce/product-listing.ts` caches both the page and the shell under the
`products` tag with a 60-second window. The window is short because checkout
moves stock without any admin action, and a listing that confidently shows a
sold-out item as available is worse than one that is a minute stale.

`withAdminAuth` drops the tag after every successful mutating admin request —
the same argument that put the audit log there: a route that has to remember to
invalidate is a route that eventually does not, and the failure mode is a
shopkeeper who edits a price and does not believe the save worked. That is
broader than strictly necessary (a shipping-zone edit changes no listing), but
an admin write is rare and an unnecessary drop costs one uncached query. Order
writes genuinely do belong: they move stock and they change the best-selling
ranking.

## Product faceting (`20251101002900`)

The listing offered category and subcategory and nothing else, and always
sorted by `created_at desc`. Two of the missing facets could not have been
built in the browser, which is why the query moved server-side:

- **Best-selling** reads `order_items`, and `20251101001700` took anon's read
  on the order tables away. `product_sales` is a view over those tables with no
  grant to anon or authenticated; only the SECURITY DEFINER `list_products()`
  reaches it, and it returns a count, never an order.
- **Size and colour** are per-variant. `products.sizes` / `products.colors` is
  the legacy copy the admin form still writes; `product_variants` is what is
  actually sellable. A size whose only variant is deactivated should not be
  offered, and only the variants table knows that. Products with no variant
  rows still fall back to the legacy arrays.

Price bands filter on the **cheapest active variant**, not `products.price`. A
gown listed at ₦12,000 whose smallest size is ₦6,500 belongs in "under
₦10,000", because that is the truthful answer to "can I afford this".

`product_facet_options()` is scoped by category only, deliberately. If picking
"Blue" pruned the size list to sizes that come in blue, a shopper who then
wanted size 2 would find it missing and conclude the store has none.

**On-sale is not in SQL.** Which discount applies to a product is decided by
`getBestDiscount()` in `lib/commerce/discounts.ts` — scope precedence, date
windows, variant targets. A PL/pgSQL reimplementation would be a second answer
to the same question and the two would drift. `/api/products` applies that
facet itself, in TypeScript, calling the same function the ProductCard badge
calls. It does so *before* paging, which is why `list_products()` allows a
LIMIT of 100: with the facet on, the route scans a wider slab, filters it, then
pages the result, so a page is never short. If the scan hits that ceiling the
response says `truncated: true` and the UI stops claiming an exact count.

## Product search (`20251101002800`)

`products.search_vector` is maintained by a **trigger, not a generated column**.
A generated column needs an IMMUTABLE expression and
`array_to_string(details, ' ')` is only STABLE — the same restriction that made
`20251101002600` fail its first push with `42P17`. A `BEFORE` trigger has no
such limit and is the long-standing Postgres pattern for this.

Weighting is name (A), category and subcategory (B), detail bullets (C),
description (D), so "gown" ranks a product *called* Baby Gown above one that
merely mentions gowns.

The tsquery is built inside `search_products()`, not by the application. Terms
are rebuilt from word characters and joined with `&`, with `:*` on the last one
for typeahead — so nothing a visitor types can reach `to_tsquery` as an
operator, and there is exactly one place that decides what a query means.

`search_queries` records what was searched for and how many results it
returned. The zero-result rows are the valuable half: demand, in customers' own
words, that the catalogue does not meet or does not name the same way. It holds
nothing identifying — no IP, no session — because the demand signal does not
need it and storing it would make the table personal data.

## Audit trail (`20251101002700`)

`audit_log` is written from inside `withAdminAuth`, not by individual routes. A
route that has to remember to log is a route that eventually does not, so every
mutating admin request produces at least one entry — actor, method, path, IP,
response status and the submitted body — whether the handler says anything or
not. Handlers that can describe a real before/after call `ctx.audit(...)` and
their richer entries replace the generic one.

Making that actually automatic meant moving four routes onto the wrapper. They
were calling `verifyAdminAuth` themselves — order status changes, shipping
overrides, change-request approvals and category CRUD — so the most
consequential actions in the admin were the ones leaving no trace. The
categories route was also building its own Supabase client inline, three times.

`entity_id` is **text**, not uuid: a stock change is addressed by variant key
(`3-5 months|Yellow`), a category by slug. A uuid column would force those to
be logged as something they are not.

The table is **append-only** — a trigger refuses `UPDATE`. An entry that can be
edited is not evidence, and the realistic risk is not an attacker (anyone with
the service-role key already owns the database) but a well-meaning script
"correcting" history. `DELETE` stays possible so retention can be, via
`prune_audit_log()`, which refuses to touch anything under 30 days old.

Secrets are redacted on the way in, by key name, because request bodies are
recorded automatically — see `lib/api/audit.ts`.

## Variants as rows (`20251101002600`)

Variants moved out of `products.pricing_config` and into `product_variants`,
one row per sellable combination.

`variant_key` is kept as a **generated column**
(`COALESCE(NULLIF(concat_ws('|', size, color), ''), 'single')`) because it is
the addressing scheme the whole application already speaks — the admin stock
page, discount variant targeting and cart lines all use it. Nothing persists a
key, so changing how one is spelled breaks no stored data.

One spelling did change: a `single`-mode product that recorded a size and a
colour used to be addressed as `'single'`; as a row it is addressed as
`'S|Multicolour'`. `findVariant()` resolves both, narrowly — only for a product
with exactly one variant, and never substituting one explicit selection for a
different one.

`products.stock` is now a trigger-maintained `SUM` of its variants. That is the
whole point: the drift repaired in `20251101001600` and the write race fixed in
`20251101002400` were both inherent to keeping a total by hand next to buckets
inside a JSON document.

`sync_variants_from_pricing_config()` is a function rather than an inline
backfill because the admin product form still submits a `pricing_config`, so
something must derive rows on every save. Writing that in SQL for the backfill
and again in TypeScript for the form would be two implementations of one rule —
the drift trap this project already hit with the phone normaliser. The
migration's backfill and `app/api/admin/products/route.ts` call the same
function.

`pricing_config` is deliberately **not** dropped. It still holds `colorImages`,
still feeds the admin form, and is still the fallback for a product whose
variant rows are missing or whose query did not embed them. Removing the now-dead
price and stock maps is a later, separate migration.

Anon reads variants of active products, but `cost`, `barcode` and `sku` are
withheld by a **column-level GRANT** — RLS filters rows, not columns. A
consequence: `select('product_variants(*)')` fails for anon, because expanding
`*` touches `cost`. Anon-key queries must name columns, which is what
`PUBLIC_VARIANTS_SELECT` in `lib/commerce/product-variants.ts` is for; a test
asserts it matches the GRANT.

## Customer identity (`20251101002500`)

`customers` is keyed on **normalised email alone**, not email + phone.

The live data disproves the composite key: phone `09068830372` already appears
on orders for two different email addresses. A unique constraint spanning both
columns would either split one buyer into two rows the moment they retyped
their number differently, or refuse the second buyer's order outright. Phone is
stored (raw and normalised) and indexed for lookup, but is not an identity
constraint.

`orders.customer_name` / `customer_email` / `customer_phone` are left exactly
as they are. They are the immutable record of what was typed at that checkout —
the address a receipt went to, the name on the parcel. `customers` holds the
current, mutable identity. A test in `lib/commerce/customer-identity.test.ts`
asserts the migration's only `UPDATE` on `orders` touches `customer_id` alone.

There are no `orders_count` / `total_spent` columns. `customer_stats` derives
them from `orders` on read, so they cannot go stale — this project has already
had a denormalised counter drift from its source (`products.stock`, repaired in
`20251101001600`).

The migration carries a SQL copy of the phone normaliser
(`normalise_ng_msisdn`) purely so the backfill can populate `phone_e164` for
pre-existing orders; the application uses the TypeScript original. Because two
implementations of one rule will drift silently, a test probes both and asserts
they accept exactly the same set of mobile prefixes.

## Conventions

- **Idempotent where practical** — `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP … IF EXISTS`. Several of these have been run more than once.
- **Explain the why in a header comment.** The existing files do this well and
  it is the main reason the original order could be reconstructed at all.
- **Data repairs are migrations too** (e.g. `…001400`, `…001600` step 4), so a
  rebuilt environment ends up in the same state.
- **Diagnostics are not migrations.** Read-only investigation queries live in
  `scripts/diagnostics/` so `db push` and `db reset` never execute them.

## Reviews (`20251101003300`)

Checkout asks a stranger to transfer money to an account number and wait. There
was nothing anywhere on the page suggesting anybody had ever done that and been
happy — and on a transfer-first checkout, trust is the binding constraint.

Three objects and a bucket:

- **`product_reviews`** — rating (1–5, the only required field), optional title,
  body and up to four photos, the variant that was bought, the moderator's
  private note, and the shop's public reply. Rows land as `'pending'`; the
  storefront reads `status = 'published'` only.
- **`order_review_invites`** — one row per order, holding a **SHA-256 hash** of
  the token that went out in the email. Possession of the token is the
  verified-purchase proof, and there is no other way to write a review, so the
  spam problem this table would otherwise have does not exist. Hashing is done
  in Node (`lib/commerce/review-token.ts`) because `digest()` lives in the
  `extensions` schema on hosted Supabase.
- **`product_review_stats`** — a view, not maintained counters. Same reasoning
  as `rebuild_product_pairs()`: a derived number that is recalculated cannot
  disagree with its rows, and un-publishing a review leaves no state to repair.
- **`review-photos`** — public, unlike `receipts`, because a review photo is
  content the product page shows everybody. What keeps it safe is that no anon
  or authenticated policy exists: uploads go through `/api/reviews/photos`,
  which checks the token, checks the magic bytes, and writes to a path prefixed
  with the order's id.

### The aggregate is merged in TypeScript, not added to `list_products()`

Stars on a product card need the average and the count, and the obvious move is
to widen `list_products()` and `product_cards()`. Both are shared projections,
and changing a return type means `DROP FUNCTION` and re-emitting 150 lines of
SQL per migration — twice, in two files that must not drift. Instead
`attachReviewStats()` does one indexed read over `product_review_stats` for the
ids a page already returned, and every card surface goes through it. The SQL
functions were not touched.

### One review per (order, product)

Enforced by a partial unique index, because the invite is for the *order*: a
two-item order gets one link and one form per item, and without the index the
same buyer could post the same item twenty times and own its average rating.
The form groups order lines by product for the same reason — a single order can
hold one product in two sizes.

## Questions and answers (`20251101003400`)

Reviews are evidence from people who already bought. This is the other half:
the shopper who has *not* bought, and has one specific question — will it fit a
chunky six-month-old, is the cotton lined, does the gown come with the bonnet.
Before this they guessed, or messaged WhatsApp and waited, or left.

### Open to anyone, unlike reviews

A review is a claim about a purchase and needs proof of one. A question is the
opposite — the whole point is that it comes from somebody still deciding — so
`/api/questions` is unauthenticated and defended the way the contact form is: a
honeypot, a rate limit, length caps, and moderation as the thing that keeps
anything unvetted off the product page.

### One table, not two

An answer has no life of its own: it cannot exist without its question, there
is exactly one per question, and every read wants both. A second table buys a
join and nothing else.

### Publishing requires an answer

Enforced in `lib/commerce/question-moderation.ts` rather than as a CHECK,
because a constraint would also forbid the intermediate states the admin form
moves through. The rule is checked against the *resulting* row, which is what
catches all three ways of reaching it: publishing an unanswered question,
clearing the answer from a published one, or doing both in one request. A
published question with nothing under it is a visible unanswered doubt on the
product page — it reads as "somebody asked and nobody could be bothered".

### Publishing mails the asker

`answer_notified_at` claims the row before the send, so a second publish is a
no-op; it is cleared again if the answer is later replaced, because a new
answer is a new thing to tell them. Being emailed the answer is the only reason
the address is required, and the ask form says so.

### No FAQPage markup

Deliberately. FAQ rich results are limited to authoritative health and
government sites, and QAPage describes a page whose primary subject is one user
question — which a product page is not. Marking it up as either would tell a
crawler something untrue in the hope of a rich result the page cannot get. The
visible text is the SEO value; the structured data stays Product plus its
aggregateRating.

## Size guides (`20251101003500`)

The product page showed raw size strings and nothing else — on a store selling
clothes for growing children, the worst possible place to be silent. Sizing is
inconsistent between brands, children change size every few months, and
"6-12 months" means different things to different parents.

### The tables are in code, not in the database

`lib/data/size-charts.ts` holds the baby, kids, letter and maternity charts.
They are standard UK/EU bands, they do not vary per shop, and a table nobody
can edit is a table nobody can get wrong. What this migration adds is only the
part that *is* specific to this shop:

- **`categories.size_guidance`** — a paragraph per category, written by whoever
  answers the "will this fit" messages. "Our sleepsuits have fold-over mittens
  so the arms run long" is knowledge that lived in one person's head.
- **`products.fit_rating` + `fit_note`** — two columns rather than one free-text
  field, because the rating is what the selector shows inline without opening
  anything. "Runs small" buried in a paragraph is not something the code can
  branch on.

An unrecorded fit is NULL, never `'true_to_size'`: the admin form's default is
"Not recorded", because a form that defaults to a fit claim publishes one
nobody checked.

### `sizing_type` gains `'maternity'`

The column already distinguished `'size'` from `'age'` — which is what picks
between the letter chart and the age charts — and nothing had ever read it. The
guide now does, and maternity needs a third value: body measurements against a
pre-pregnancy size. `chartForProduct()` also falls back to the maternity chart
for a product in the maternity category whose `sizing_type` was never set, so
existing rows are right without anybody editing every one of them.

### Deploy order does not matter

`loadProductDetail` reads the category row with `select('*')` rather than naming
`size_guidance`. Naming it would make the query fail outright against a
database that has not had this migration applied, which would quietly cost the
breadcrumb its category name in the window between a deploy and a `db push`.
The product row was already selected with `*`, so `fit_rating` and `fit_note`
appear on their own once the columns exist.

## Customer accounts (`20251101003600`)

Checkout was guest-only and the only route back to an order was `/track-order`
with the order number plus a matching email or phone. Lose the number, lose the
order — and a repeat buyer retyped their name, phone and full delivery address
every time, on a phone keyboard.

### No passwords, and the same trust model as before

`verifyOrderContact` already established what counts as proof: control of the
email or phone on the order. This widens that from one order to all of them and
proves it the same way — by sending a link to the address **on file**, never to
an address supplied in the request. A stranger naming somebody else's phone
number gets a link sent to that person's inbox, not to their own.

### Two tables, because they are two lifetimes

- **`customer_auth_tokens`** — the challenge. Single use, 20 minutes, one row
  per sign-in attempt.
- **`customer_sessions`** — what the browser then holds. 30 days, one row per
  device, and a **row rather than a JWT** on purpose: this is the credential
  that reads a person's whole order history, so signing out has to actually
  revoke it. A self-contained token stays valid whatever the database says.

Both store only a SHA-256 hash, computed in Node (`bearer-token.ts`, shared
with the review-invite tokens) because `digest()` does not resolve unqualified
on hosted Supabase.

### The sign-in endpoint answers nothing

`/api/account/login` responds identically whether the contact matched one
customer, several, a blocked one, or nobody. Anything else turns it into a way
to ask "does this person shop here" — of a shop selling baby clothes. A phone
number matching more than one customer deliberately sends **nothing**: this
schema documents one number shared by two email addresses (see
`20251101002500`), so there is no safe way to choose.

### Redemption is a POST, from a landing page

The emailed link is a GET to `/account/verify`, which renders a button. Mail
providers and security scanners prefetch links, and the token is single use —
redeeming on GET would mean customers arriving at a link a scanner had already
spent.

### Which orders are "yours"

`customer_id` OR the `customer_email` snapshot on the order. The second is what
makes every order placed before the `customers` table appear — which is most of
the history a returning customer wants. Phone is deliberately not part of the
match, for the same reason the sign-in lookup refuses an ambiguous number.

### Reorder re-prices

`buildReorderLines` rebuilds a past order at **today's** prices, clamps each
quantity to current stock, and names what could not come back. Adding lines at
the price that was paid would put a cart on screen that disagrees with the
checkout quote, and the customer would discover that at the total.

## Wishlist across devices (`20251101003700`)

The wishlist lived in localStorage, so the list built on a phone did not exist
on the laptop it was bought from. Now that a customer can be signed in without
a password, it can follow them — and localStorage stays the guest wishlist and
the local cache either way.

**Ids only.** The browser stores whole product snapshots so a guest's list
survives with no server; this table stores which product, because a signed-in
list is looked up through `product_cards()` and shows current prices.

**The merge is a union, always.** Nothing on either side records *when* an
entry was added or removed, so a last-write-wins rule would silently delete
saved products. Union can only over-keep, which costs one unwanted row the
customer removes in a tap. Removal is therefore explicit and immediate: once
signed in, un-hearting deletes on the server too, or it would come back on the
next sync.

## Online payments (`20251101003800`)

Bank transfer was the only way to pay: read the account details, leave for a
banking app, screenshot the receipt, come back, upload it — then wait, which is
where the support messages live and why this shop needed a payment-reminder
cron. On the shop's side it is a human inspecting an image on every order.

**Beside, not instead of.** Transfer is unchanged and still first-class. What
is new is a second column — card, bank, USSD or transfer through Paystack,
verified automatically.

**Four columns and nothing else.** The status machine, stock reservation and
notification pipeline are untouched: an online payment arrives exactly where a
verified transfer arrives, `payment_verified` true and status `confirmed`, via
`applyOrderStatusTransition`.

**The reference is shaped `<order number>-<random>`** so a webhook can always
recover the order — match the reference exactly, and fall back to the order
number before the dash. Order numbers are `UT` + 8 digits and contain no dash,
which is what makes that parse unambiguous, and it is what saves an order where
the customer abandoned one attempt and paid on another.

**No `payment_events` table.** Considered. Idempotency does not need one: the
guard is `orders.payment_verified`, a fact that cannot drift from itself. A log
of raw provider payloads is the obvious next step if disputes ever become a
thing here, but adding it now would be storing evidence for a problem this shop
does not have.

**The amount is always checked**, and a mismatch is never confirmed — it is
flagged for a person, because confirming anyway and refusing a genuine payment
are both worse than a shopkeeper looking at it.

**The callback URL carries no reference.** Paystack appends both `reference`
and `trxref` itself. Adding ours made the parameter repeat, Next parsed it as
an array, and the array reached verify encoded as `"X,X"` — so a customer whose
card had been charged was told the payment had not been seen. The return page
now reads its own record first and only asks the provider if that comes back
unpaid, so a provider hiccup can never misreport a paid order.

**The payment-reminder cron now skips online orders.** Its email tells somebody
to transfer money and upload a receipt, which is the wrong instruction for an
order started at the provider.

## Payment events (`20251101003900`)

003800 shipped without this deliberately, and this adds it deliberately. What
changed is not the reasoning about idempotency — that guard is still
`orders.payment_verified`, a fact that cannot drift from itself — but that
three questions turned out to have no answer without a log: settling "he says
he paid", finding a payment whose confirmation threw after the money landed,
and reconciling a month.

**Only signature-verified events are stored.** Logging rejected attempts is the
more obvious security choice and is the wrong one: the webhook endpoint is
public, so it would turn an unauthenticated request into an unbounded write and
a stranger could fill the table by looping. A bad HMAC is counted in the server
log and dropped.

**Retries collapse.** A provider resends until it gets a 200, so the partial
unique index on (provider, transaction_id, event, outcome) keeps one row per
distinct thing that happened rather than one per delivery.

**Never pruned.** One row per payment, growing no faster than `orders` — and
the value of a financial record is precisely that it is still there in a year.

**No card data.** The payload is what Paystack sends, which carries a bin,
last4, card type and bank, and never a PAN or CVV.

## Abandoned carts (`20251101004000`)

The cart lived in localStorage and nowhere else, so somebody who filled in
their details and went to find their banking app left no trace. On a
transfer-first checkout that is the worst gap in the funnel: those people meant
to pay.

### One row per email, not one per visit

The row is "the cart we last saw for this address", not a log of abandonment
events. A shopper who edits their basket four times produces one reminder, and
the table grows with distinct customers rather than with visits.

### The restraint is the feature

This is unsolicited mail to somebody who typed an address into a form, so every
rule that stops it sending is in `lib/commerce/abandoned-cart.ts` as a named,
tested function rather than a condition in a cron route:

- **Two, ever.** `first_sent_at` and `second_sent_at` are stamps, not counters.
- **Never after they buy.** `recovered_at` is set by the order-created effects,
  so a reminder cannot arrive after the thing it is reminding them to do.
- **Never again if they ask.** `opted_out` is permanent and is not cleared when
  the row is reused for a later cart. The opt-out is a visible link, not grey
  four-point text.
- **A fresh sequence only after 14 days.** Without that, somebody who browses
  weekly would be reminded weekly forever, because each visit refreshes the row.
- **Both deadlines run from `abandoned_at`** — the last time the cart was seen
  — so the first email cannot land while they are still choosing sizes, and a
  late first email does not drag the second out with it.

### Items are ids, prices are not stored

The snapshot records what was in the basket, never what it cost. The email is
built from the catalogue at send time, so it can never quote a price the shop no
longer charges, and anything sold out or delisted is dropped — if that leaves
nothing, no email goes at all.

### The resume link is a basket, not a session

It restores a cart and grants nothing else: no account, no order, no address.
The token is rotated on every send, so the link in an older reminder stops
working, and it is stored only as a SHA-256 hash like every other bearer token
here.

### This one needs an hourly cron

The first reminder is due an hour after abandonment, so `vercel.json` schedules
`0 * * * *`. **Vercel Hobby only runs cron once a day** — on that plan the
hourly schedule will not fire, and the sweep needs either Pro or an external
scheduler (GitHub Actions, cron-job.org) calling the endpoint with the
`CRON_SECRET` header.

## The order stops being immutable (`20260905190000`–`20260905190400`)

Five migrations that belong to one change: an order can be edited, cancelled
with a reason, refunded, and tracked. They are separate files because they are
separate objects with separate rollback stories, and they are listed together
here because none of them is much use alone.

### `20260905190000` — the money breakdown

`orders.total_amount` was one integer with no record of what produced it. Three
things were impossible while that was true: printing an invoice, editing the
order (the second edit cannot tell how much of the total was shipping), and
recording a goodwill discount.

The invariant is `total_amount = items_subtotal + tax_amount + shipping_amount
- discount_amount`, enforced by a CHECK. The backfill derives the split from
the line items and the known tax rate; where a legacy total falls below the sum
of its parts, the shortfall is recorded as a discount rather than clamped, so
every existing row satisfies the constraint by construction.

### `20260905190100` — `edit_order_items()`

An edit is four writes that must succeed together: release the old stock, claim
the new, replace the lines, recompute the total. The Supabase JS client cannot
open a transaction across statements, so this is one function — an oversell
raises GM001 out of `adjust_order_stock` and Postgres unwinds the release with
it.

Stock is released *before* it is claimed, not netted per variant. Netting would
be fewer row updates and would also make "change quantity from 3 to 4 on the
last 3 units" fail against a hold the same order already owns.

The tax rate is an argument. `TAX_RATE` lives in `lib/commerce/checkout.ts` and
is what `priceOrder()` charged; a second copy in SQL would be free to drift
from it.

### `20260905190200` — `order_refunds`

`order_payments`' mirror image, with one deliberate difference: a row here is
updated in place. A verification is instantaneous, but a refund is agreed now
and sent later, so `pending` → `completed` / `failed` is the same event
reaching its conclusion rather than a revised opinion. A trigger freezes the
order, the amount and the reason once written, and refuses to reopen a settled
row — a correction is a new refund, which is the history worth keeping.

`orders.amount_refunded` sums the completed rows, maintained by trigger for the
same reason `amount_paid` is.

### `20260905190300` — cancellation reasons

`order_status_history` gains `reason_code` beside the free text added in
`20260905170100`. Free text does not aggregate: "no stock", "out of stock" and
"oos" are three spellings of one answer. The vocabulary is
`lib/commerce/cancellation-reasons.ts`; the column is deliberately
unconstrained, because a code from a newer deployment is data rather than
corruption and refusing it would fail the cancellation itself.

`order_cancellations` joins each cancelled order to its latest cancelled
history entry — per-order rather than pre-aggregated, because "how many were
out of stock" and "which ones" are both asked and only one of those survives a
rollup.

### `20260905190400` — courier and waybill

Three columns on `orders`. `tracking_url` is stored rather than derived so a
courier changing its URL format cannot rewrite history, and a CHECK refuses
anything that is not `http(s)` — the value ends up as an `href` in a customer's
inbox.

## Customer segments (`20260905190500`)

`customers.tags` as a `text[]` with a GIN index, not a join table: tags are read
on every row of the customer list, written one customer at a time by a human,
and have no attributes of their own. A trigger lowercases, trims, deduplicates
and caps them — a CHECK could only refuse "Wholesale" for not being
"wholesale", which turns a typo into a failed save instead of fixing it.

`customer_addresses` derives the addresses a buyer has actually used from their
orders, for the same reason `customer_stats` derives its figures: an address
book kept beside the orders it came from is one that drifts from them.

`customer_stats` gains `tags`, `lifetime_refunded` and `net_lifetime_value`,
appended rather than reshaped — `CREATE OR REPLACE VIEW` may add columns to the
end and may not change the ones already there, so `lifetime_value` keeps its
exact definition and its type while the net figure arrives beside it.

## Money moves to minor units (`20260910130000`)

Every money column was `integer` whole Naira, including the premise stated
outright in `20260905190000`: "a price this shop sets does not [have kobo]".
That premise blocks two things at once -- a sub-unit price, and any market
that isn't priced in whole Naira -- which is the whole reason this migration
exists. It also fixes a real inconsistency already in the schema:
`order_payments.amount` / `order_refunds.amount` were `numeric(12,2)` because
a bank transfer genuinely lands with kobo on it, while everything else was a
whole-number column of the same kind of value.

**bigint, not integer.** `nairaInt` in `admin-orders.ts` already allowed
amounts up to 100,000,000 Naira; x100 that's 10,000,000,000, past `integer`'s
~2.1 billion ceiling. Every converted column widens to `bigint`.

**Guarded by the column's own current type**, not a marker table: each
`ALTER COLUMN ... TYPE bigint` is wrapped in a check against
`information_schema.columns.data_type`, so a second run of the file finds
`bigint` already there and does nothing. Two loops (one for plain integer
columns, one for the `numeric(12,2)` pair) do this for ten-plus columns at
once rather than repeating the same six lines with the names swapped.

**`orders`' breakdown columns convert in one `ALTER TABLE`, not five.**
`orders_total_matches_breakdown` (`20260905190000`) checks
`total_amount = items_subtotal + tax_amount + shipping_amount - discount_amount`.
Postgres validates a table's CHECK constraints once per `ALTER TABLE`
statement, not deferred across several -- converting the five columns one
statement at a time would fail the invariant the moment the first column had
scaled and the rest had not. All five appear as separate `ALTER COLUMN`
clauses inside a single statement instead, so the constraint is only ever
compared after every column already agrees.

**`discounts.value` scales only where it's money.** `PERCENTAGE` stores
0-100 and `FREE_SHIPPING` is pinned to 0 by `discounts_free_shipping_value`
(`20260906150000`); only a `FIXED` row's `value` is actually Naira. The
column-type change and the conditional multiply happen in the same
`USING` expression, keyed on `type`.

**`pricing_config` converts too, and needs its own guard.** `getVariantPrice`
/ `getProductPriceRange` (`lib/commerce/pricing.ts`) still fall back to this
JSONB for any product with no `product_variants` rows, so leaving its
`sizePrices` / `colorPrices` / `combinationPrices` maps unconverted would
make exactly those products render at 1/100th price. JSONB carries no type to
branch on, so the guard is a `_minorUnits: true` marker key written after
conversion. The sibling stock maps (`sizeStock`, `colorStock`,
`combinationStock`, `singleStock`) are quantities, not money, and are
untouched.

**Two currency columns, not one**, mirroring `20251101002500`'s reasoning for
snapshotting customer identity onto the order rather than joining it live:
`store_settings.currency` is the shop's current default (read the same way
`tax_rate` already is, including through `store_settings_public`);
`orders.currency` is frozen at checkout, so a later change to the shop's
default currency cannot rewrite what a past order actually charged. Existing
orders backfill to `'NGN'` -- every one of them was.

**Scope.** This converts one database's existing values in place, which is
correct for a single environment with no other reader of its raw columns. It
is deliberately not the pattern for rewriting a live tenant without downtime
-- that needs an online expand/backfill/contract sequence, which is the
"coordinated rewrite" this migration's own ticket explicitly defers to later.
A currency *picker*, exchange rates, and per-tenant currency configuration in
the admin are equally out of scope here.

### Failed first push: a view stood in the way

`ERROR: cannot alter type of a column used by a view or rule (SQLSTATE 0A000)`,
naming `most_wishlisted`'s dependency on `products.price`. Nothing was
applied. Postgres refuses `ALTER COLUMN ... TYPE` outright when a view's rule
reads that column, with no workaround short of dropping the view first --
unlike a table's CHECK constraints, there is no deferred or per-statement
option here.

Three more views turned out to read a column this migration converts once the
first was found and the rest were checked for the same thing:
`customer_stats` and `order_cancellations` both read `orders.total_amount` /
`amount_paid` / `amount_refunded`; `store_settings_public` reads
`free_shipping_threshold` (and was already being recreated in step 6, to gain
`currency`, so only needed the same early drop). Step 0 drops all four before
any `ALTER COLUMN` runs; step 8 recreates the three not already handled,
verbatim from their own migrations -- a view's SELECT list re-types itself
from its now-bigint source columns, so nothing about their definition changes.

### A second class the view error didn't warn about: functions

A view blocks `ALTER COLUMN ... TYPE` outright, so the first failure was loud
and immediate. A function does not -- `product_candidates()`, `count_products()`,
`list_products()`, `product_cards()`, `search_products()` and
`storefront_traffic_without_sales()` all declare a `RETURNS TABLE` price
column as `integer` and `SELECT` straight from what is now a `bigint` source.
That would not have failed the push at all: Postgres widens `bigint` into a
declared `integer` output column with an implicit assignment cast, checked
only at call time, against whatever a real price happens to be. For this
shop's prices that cast would have kept working by coincidence -- silently,
and on a bet ("nothing here costs more than ~21 million Naira") this
migration's own bigint reasoning explicitly refuses to make anywhere else.
`edit_order_items()` and `sync_variants_from_pricing_config()` have the same
problem one level down, in a plain `integer` local variable and (for the
former) an `integer` discount parameter, both fed values `admin-orders.ts`
already validates up to 10,000,000,000 minor units -- a real edit near that
ceiling would have overflowed rather than saved. `replace_product_variants()`
matched the pattern too, and is fixed alongside the rest even though nothing
in the application calls it today.

Step 9 widens all eight. Six require `DROP FUNCTION` first --
`CREATE OR REPLACE` cannot change a return type or an argument type, Postgres
treats that as a different function -- found by name through `pg_proc` rather
than hand-typed, the same defence `20260909120000` already uses for this
exact trio: a mistyped signature makes `DROP ... IF EXISTS` silently do
nothing, and the `CREATE` two statements later fails with "already exists".
The other two (`sync_variants_from_pricing_config`, `replace_product_variants`)
keep their signature and return type, so `CREATE OR REPLACE` was enough.

## The store dimension (`20260911100000`)

306+ call sites query these tables directly (`app/api`, `app/admin`), and
nobody can keep auditing all of them by hand as more get added. So isolation
has to live in Postgres, not in each call site -- which only works if the role
those call sites run as is one RLS actually applies to.

It was not. `20251101001700` documents, as a fact this migration does not
undo, that `service_role` bypasses RLS -- and `createAdminClient()`
(`lib/supabase/admin-server.ts`, 61 call sites) authenticated as exactly that.
A `store_id` column and policy added without addressing this would have
protected only the storefront's anon-key reads, the small minority of the
306+ sites, while every admin and API route kept reading every store
regardless.

**`current_store_id()`** reads a `store_id` JWT claim if one is present, else
falls back to the single default `stores` row. With one store, every caller
resolves to it whether or not it ever mentions store_id -- a call site that
forgets to scope gets the one store's data it would have gotten anyway. A
second store later needs a JWT carrying its id; the function does not change.

**Root tables get a real `store_id` column** (`products`, `categories`,
`orders`, `customers`, `discounts`, `shipping_zones`, `store_settings`,
`abandoned_carts`, `automation_rules`, `homepage_slides`,
`search_synonyms`) -- these have no foreign key to another scoped table, so
there is nothing to derive from. Everything else scopes transitively through
an `EXISTS` against its parent (`order_items` through `orders`,
`product_variants` through `products`, `return_items` through `returns`
through `orders`, and so on) rather than duplicating the column, for the same
reason `customer_stats` and `customer_addresses` are views instead of copied
data: a derived value cannot drift from what it was derived from.

**`app_service`** is a new Postgres role with the same table access as
`service_role` but, deliberately, no `BYPASSRLS`. `createAdminClient()` now
mints it a short-lived JWT (`lib/supabase/app-service-token.ts`, signed with
`SUPABASE_JWT_SECRET`) instead of sending the raw service-role key -- the fix
lives in the one factory function every call site already goes through, not
in each of them. `createSuperAdminClient()` keeps the real key, for the rare
case that must genuinely cross store boundaries; nothing in this codebase
needs it today.

**Not covered here** -- the `SECURITY DEFINER` functions elsewhere in this
file (`list_products`, `search_products`, `edit_order_items`,
`set_variant_stock`, `rebuild_product_pairs`, and the rest) run with their
*owner's* privileges, not the caller's, and every one of them is owned by
`postgres`, a superuser, which bypasses RLS regardless of any policy above.
`20260912100000` is that follow-up.

`admin_users`, `audit_log`, `notifications`, `payment_events`, `rate_limits`,
`subscribers`, `search_queries`, `storefront_events` and
`order_number_reservations` keep exactly today's access for `app_service`
(unconditional -- the same thing `service_role`'s bypass already gave them),
rather than being store-scoped. They are operational/log tables and staff
identity, not customer or financial records, and scoping them is separable
follow-up.

## Scoping the SECURITY DEFINER functions (`20260912100000`)

`20260911100000` named this gap rather than papering over it: a `SECURITY
DEFINER` function runs as its owner regardless of who calls it, every such
function here was owned by `postgres`, and a superuser bypasses RLS
unconditionally. `list_products()`, `search_products()`, `edit_order_items()`,
`set_variant_stock()` and the rest were reading and writing every store's rows
no matter which role called them.

The fix is `ALTER FUNCTION ... OWNER TO app_service` -- no signature or body
change, so nothing about what these functions do is touched, only whose
privileges their internal queries run under. Once app_service owns them,
their queries hit the exact store-scoping policies `20260911100000` already
wrote, with no new grants needed (app_service's table access was already
blanket).

Signatures are looked up through `pg_proc` rather than hand-typed, the same
defence `20260910130000` already uses and for the identical reason: several of
these functions (`list_products`, `product_candidates`, `count_products`,
`product_facet_options`, `search_products`, `product_cards`,
`storefront_traffic_without_sales`) have had their signature replaced outright
via an explicit `DROP FUNCTION` at least once, precisely because
`CREATE OR REPLACE` cannot change a return or argument type. A hand-typed,
mistyped signature would make the `ALTER` silently match nothing.

**Left owned by `postgres`, deliberately:** `is_active_admin()` (admin
identity is a different question from store scope, and it must keep reading
the locked-down `admin_users` table regardless of store context); anything
touching only the tables `20260911100000` already left unscoped
(`check_rate_limit`, `prune_audit_log`, and the like -- reassigning them would
be a no-op at best); and the plain `touch_*_updated_at` triggers, which write
only the row already being changed by the caller's own statement and touch no
other table.

**Still not verified against a live database.** The `ALTER FUNCTION` itself is
inert as a schema change (same signature, same body), but this session cannot
run checkout, stock adjustment or order editing against a staging copy of the
real data to confirm every one of these functions' internal queries succeeds
under app_service's grants and policies. Exercise the checkout, stock-save,
order-edit and returns flows once this is pushed, before trusting them in
production.

## The attribute engine (`20260912110000`)

`product_variants` hardcoded exactly two axes, `size` and `color`, since
`20251101002600`. A store selling anything not describable as size-and-colour
— a candle needing "Scent", a phone case needing "Model" — had no way to add
that axis without another schema migration and another round of two-axis
logic in every function that touches a variant.

**The axis set becomes data.** Two new tables, `product_attributes` (the
catalogue: key, display name, input type, sort order) and
`product_attribute_values` (known values per attribute, e.g. every colour
ever used), seeded with `size` and `color` as system attributes so every
existing product validates against the catalogue with zero data changes.
`product_variants.attributes jsonb` — e.g. `{"size":"M","color":"Red"}` — is
now the per-variant source of truth, GIN-indexed for containment queries.

**No join table.** A `variant_attribute_values` table recording the same
per-variant assignment a second time was considered and dropped —
`product_variants.attributes` already *is* that assignment.
`product_attribute_values` holds only the catalogue of values seen so far,
populated automatically the first time a value is used.

**`size` and `color` become real `GENERATED ALWAYS AS ... STORED` columns**
— `attributes ->> 'size'` / `->> 'color'`. JSONB extraction on the row's own
column is IMMUTABLE with no subquery, so this is legal, and it is literally
the technique `20251101002600` already used for `variant_key`. Every existing
SQL function, the RLS column-level GRANT, and every TypeScript file that
reads `.size`/`.color` — including `PUBLIC_VARIANT_COLUMNS` in
`lib/commerce/product-variants.ts`, which a test asserts matches the GRANT
byte-for-byte — needed zero changes.

**`variant_key` stops being generated and becomes trigger-maintained.**
Composing a key from an arbitrary, catalogue-ordered set of attributes needs
a join against `product_attributes.sort_order`, which is no longer
expressible as a subquery-free IMMUTABLE generated-column expression — the
same reason `products.search_vector` (`20251101002800`) is a trigger and not
a generated column. A `BEFORE INSERT OR UPDATE OF attributes` trigger
(`product_variants_set_key`) requires every attribute key present to already
have a catalogue row for that variant's store — catalogue-first, so you
cannot set a value for an attribute that doesn't exist — then joins the
present keys to their `sort_order` and pipe-joins the values, falling back to
`'single'`. With only `size` (sort_order 1) and `color` (sort_order 2)
present, this reproduces the old `size|color` ordering byte-for-byte for
every existing row.

**`replace_product_variants` becomes the real generic write path.** Per its
own `20251101002600` comment it was unreferenced by any application code, so
this is where a future caller can post `{"attributes": {"size":"M","material":
"Cotton"}}` per item, while today's flat `{"size":.., "color":..}` shape
keeps working unchanged (resolved to the same `attributes` object either
way). `sync_variants_from_pricing_config` only changes its INSERT target
(`attributes` instead of `size, color`) — it stays a legacy two-axis importer
by nature, since `pricing_config` itself has no notion of a third axis.

**`create_product_attribute()`** is the one new admin entry point: declares a
new axis (key, display name, input type) for the current store. Everything
else — the values themselves — auto-populates the first time a variant uses
them, via a second, `AFTER`, trigger.

**Deliberately not done here:** no anon/authenticated grant on either new
table (nothing in the storefront reads the catalogue yet), and no
TypeScript changes at all — the generated-column bridge is what makes that
true. The admin variant editor's asymmetric size-outer/colour-inner data
model, the storefront's hardcoded two-block selector, and the half-dozen ad
hoc `${size}|${color}` key-joins scattered outside `variantKeyFor` (cart,
discount variant targeting, order editing) are real follow-up work, tracked
in `BACKLOG.md` rather than left as a silent gap.

## After applying these

`types/database.ts` is generated from the linked project. Run `npm run db:push`
and then `npm run db:types` so the generated types match the schema rather than
the hand-written stand-ins added alongside these migrations.
