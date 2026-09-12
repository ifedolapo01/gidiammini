-- ============================================================================
-- Money moves to minor units, and an order remembers its currency
-- ----------------------------------------------------------------------------
-- Every money column in this schema is integer whole Naira -- see the "WHY
-- INTEGERS" note in 20260905190000, which states the premise this migration
-- retires: "a price this shop sets does not [have kobo]". Two things follow
-- from that premise being wrong the moment this store sells anywhere else:
--
--   * No sub-unit price. 999.99 of any currency cannot be stored.
--   * No currency at all. Nothing says what a number even means -- 'NGN' is a
--     literal in lib/commerce/pricing.ts and in the Paystack call, not data.
--
-- There is already a real inconsistency this migration also resolves:
-- order_payments.amount / order_refunds.amount are numeric(12,2), because a
-- bank transfer routinely lands with kobo on it, while every other money
-- column is integer whole Naira -- two representations of one kind of value.
-- payment_events.amount_kobo is already minor units, verbatim from Paystack.
--
-- SCOPE: ONE MIGRATION TODAY, A COORDINATED REWRITE LATER
--
-- This converts the schema and backfills existing values in place. That is
-- correct for a single database with no external consumers of its raw column
-- values. It is deliberately NOT the plan for rewriting a live tenant's data
-- without downtime -- that needs an expand/backfill/contract sequence run
-- online, which is exactly the "coordinated rewrite" this ticket defers.
--
-- WHY bigint, NOT integer
--
-- lib/api/schemas/admin-orders.ts already allows amounts up to 100,000,000
-- Naira. x100 that is 10,000,000,000 -- past integer's 2,147,483,647 ceiling.
-- Every converted column becomes bigint. PostgREST returns bigint as a plain
-- JSON number, and every real amount here stays far under
-- Number.MAX_SAFE_INTEGER, so no client-side string handling is needed.
--
-- WHY TWO CURRENCY COLUMNS, NOT ONE
--
-- store_settings.currency is the shop's current default, alongside tax_rate
-- as the other setting priceOrder() reads. orders.currency is a frozen
-- snapshot taken at checkout, the same pattern 20251101002500 already uses
-- for customer_name/email/phone: the shop's default can change later without
-- rewriting what an already-placed order was actually charged in.
--
-- Idempotent throughout: every ALTER COLUMN TYPE is guarded by the column's
-- *current* type, so a second run finds bigint already in place and skips.
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Views that stand in the way
-- ---------------------------------------------------------------------------
-- A real failed push: ALTER COLUMN ... TYPE refuses outright when a view's
-- rule depends on that column -- "cannot alter type of a column used by a
-- view or rule" -- and Postgres does not offer a way around it short of
-- dropping the view first. Four views read a column this migration converts:
--
--   most_wishlisted      (20260904130000) reads products.price
--   customer_stats       (20260905190500) reads orders.total_amount, amount_refunded
--   order_cancellations  (20260905190300) reads orders.total_amount, amount_paid, amount_refunded
--   store_settings_public (20260905200000) reads store_settings.free_shipping_threshold
--
-- store_settings_public is recreated in step 6 below regardless (it gains the
-- currency column), so only needs dropping here. The other three are
-- recreated verbatim in step 8, once every column they read is already
-- bigint -- CREATE OR REPLACE VIEW after the type change needs no USING
-- clause of its own; a view's SELECT list is just re-typed by the columns it
-- now reads.
DROP VIEW IF EXISTS public.most_wishlisted;
DROP VIEW IF EXISTS public.customer_stats;
DROP VIEW IF EXISTS public.order_cancellations;
DROP VIEW IF EXISTS public.store_settings_public;

-- ---------------------------------------------------------------------------
-- 1. Plain integer Naira columns -> bigint minor units
-- ---------------------------------------------------------------------------
-- One loop over every column that is unconditionally x100, rather than the
-- same six-line DO block repeated ten times with the table/column swapped.
DO $convert_integer_columns$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT * FROM (VALUES
      ('products',                 'price'),
      ('product_variants',         'price'),
      ('product_variants',         'cost'),
      ('order_items',              'price'),
      ('order_items',              'base_price'),
      ('shipping_zones',           'delivery_fee'),
      ('shipping_zone_exceptions', 'delivery_fee'),
      ('store_settings',           'free_shipping_threshold'),
      ('discounts',                'min_order_value'),
      ('discount_redemptions',     'amount_saved')
    ) AS t(table_name, column_name)
  LOOP
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = col.table_name
           AND column_name = col.column_name) = 'integer' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE bigint USING (%I::bigint * 100)',
        col.table_name, col.column_name, col.column_name
      );
    END IF;
  END LOOP;
END $convert_integer_columns$;

-- ---------------------------------------------------------------------------
-- 2. discounts.value -- money only when type = 'FIXED'
-- ---------------------------------------------------------------------------
-- PERCENTAGE stores 0-100, not money; FREE_SHIPPING is pinned to 0 by
-- discounts_free_shipping_value. Both must widen to bigint (the column is one
-- type) but must not be multiplied -- only a FIXED row is actually Naira.
DO $discount_value$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'value') = 'integer' THEN
    ALTER TABLE public.discounts
      ALTER COLUMN value TYPE bigint
      USING (CASE WHEN type = 'FIXED' THEN value::bigint * 100 ELSE value::bigint END);
  END IF;
END $discount_value$;

-- ---------------------------------------------------------------------------
-- 3. orders' money breakdown -- one ALTER TABLE, not five
-- ---------------------------------------------------------------------------
-- orders_total_matches_breakdown (20260905190000) checks
-- total_amount = items_subtotal + tax_amount + shipping_amount - discount_amount,
-- and orders_discount_within_order checks discount_amount against the same
-- three. Converting these one column at a time would fail that CHECK the
-- moment the first column scales and the others have not yet -- Postgres
-- validates a table's CHECK constraints after each ALTER TABLE statement, not
-- deferred across several. All five change type in a single statement instead,
-- so the invariant is compared only once, after every column already agrees.
DO $orders_breakdown$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount') = 'integer' THEN
    ALTER TABLE public.orders
      ALTER COLUMN total_amount    TYPE bigint USING (total_amount::bigint * 100),
      ALTER COLUMN items_subtotal  TYPE bigint USING (items_subtotal::bigint * 100),
      ALTER COLUMN tax_amount      TYPE bigint USING (tax_amount::bigint * 100),
      ALTER COLUMN shipping_amount TYPE bigint USING (shipping_amount::bigint * 100),
      ALTER COLUMN discount_amount TYPE bigint USING (discount_amount::bigint * 100);
  END IF;
END $orders_breakdown$;

-- ---------------------------------------------------------------------------
-- 4. numeric(12,2) Naira columns -> bigint minor units
-- ---------------------------------------------------------------------------
-- orders.amount_paid / amount_refunded, order_payments.amount and
-- order_refunds.amount: the numeric(12,2) columns, kept in kobo-having Naira
-- because money that arrives is not guaranteed to be a whole number. None of
-- these four share a CHECK constraint with each other or with the breakdown
-- columns above, so each converts independently.
DO $convert_numeric_columns$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT * FROM (VALUES
      ('orders',         'amount_paid'),
      ('orders',         'amount_refunded'),
      ('order_payments', 'amount'),
      ('order_refunds',  'amount')
    ) AS t(table_name, column_name)
  LOOP
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = col.table_name
           AND column_name = col.column_name) = 'numeric' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE bigint USING (round(%I * 100)::bigint)',
        col.table_name, col.column_name, col.column_name
      );
    END IF;
  END LOOP;
END $convert_numeric_columns$;

-- ---------------------------------------------------------------------------
-- 5. pricing_config -- the legacy per-size/colour price maps
-- ---------------------------------------------------------------------------
-- getVariantPrice/getProductPriceRange (lib/commerce/pricing.ts) still fall
-- back to this JSONB for any product with no product_variants rows, so its
-- sizePrices/colorPrices/combinationPrices leaves have to convert too, or
-- exactly those products render at 1/100th price. Their sibling stock maps
-- (sizeStock, colorStock, combinationStock, singleStock) are quantities, not
-- money, and are deliberately untouched.
--
-- JSONB carries no type to branch on, so the guard is a marker key set after
-- conversion. jsonb_each_text on a NULL/absent map is an empty set (the
-- built-in is STRICT), so a mode that never had one of the three keys gets no
-- spurious key added back by jsonb_strip_nulls.
UPDATE public.products p
   SET pricing_config = pricing_config
     || jsonb_strip_nulls(jsonb_build_object(
          'sizePrices', (
            SELECT jsonb_object_agg(e.key, to_jsonb(round((e.value)::numeric * 100)))
              FROM jsonb_each_text(p.pricing_config->'sizePrices') e
          ),
          'colorPrices', (
            SELECT jsonb_object_agg(e.key, to_jsonb(round((e.value)::numeric * 100)))
              FROM jsonb_each_text(p.pricing_config->'colorPrices') e
          ),
          'combinationPrices', (
            SELECT jsonb_object_agg(e.key, to_jsonb(round((e.value)::numeric * 100)))
              FROM jsonb_each_text(p.pricing_config->'combinationPrices') e
          )
        ))
     || jsonb_build_object('_minorUnits', true)
 WHERE p.pricing_config IS NOT NULL
   AND p.pricing_config->>'_minorUnits' IS DISTINCT FROM 'true';

-- ---------------------------------------------------------------------------
-- 6. Currency: the shop's default, and what each order actually charged
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

DO $store_settings_currency_shape$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_settings_currency_shape' AND conrelid = 'public.store_settings'::regclass
  ) THEN
    ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_currency_shape
      CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
END $store_settings_currency_shape$;

COMMENT ON COLUMN public.store_settings.currency IS
  'ISO 4217 code the shop currently prices in, e.g. NGN. orders.currency snapshots this at checkout -- changing it here never rewrites a past order.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

DO $orders_currency_shape$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'orders_currency_shape' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_currency_shape
      CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
END $orders_currency_shape$;

COMMENT ON COLUMN public.orders.currency IS
  'The currency this order was actually charged in, snapshotted from store_settings.currency at checkout. Immutable after the order is placed, like customer_name/email/phone (20251101002500). Existing orders backfill to NGN -- every one of them was.';

-- The storefront already reads tax_rate through this view with the anon key;
-- currency is exactly as public. Appended at the end: CREATE OR REPLACE VIEW
-- may add a column but may not reorder the ones already there.
CREATE OR REPLACE VIEW public.store_settings_public
WITH (security_invoker = false) AS
  SELECT
    store_name,
    support_email,
    contact_phone,
    bank_name,
    bank_account_name,
    bank_account_number,
    bank_sort_code,
    tax_rate,
    free_shipping_threshold,
    low_stock_threshold,
    currency
  FROM public.store_settings
  WHERE id = 1;

-- ---------------------------------------------------------------------------
-- 7. Column comments -- every one of these used to say "whole Naira"
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.products.price IS
  'Minor units (e.g. kobo/cents), not whole Naira. See lib/commerce/money.ts.';
COMMENT ON COLUMN public.product_variants.price IS
  'Minor units (e.g. kobo/cents), not whole Naira. See lib/commerce/money.ts.';
COMMENT ON COLUMN public.product_variants.cost IS
  'Minor units (e.g. kobo/cents), not whole Naira. What the unit costs the store, for margin reporting.';
COMMENT ON COLUMN public.order_items.price IS
  'Minor units (e.g. kobo/cents), not whole Naira. See lib/commerce/money.ts.';
COMMENT ON COLUMN public.order_items.base_price IS
  'Catalogue price per unit before any discount, in minor units. Null for rows created before 20260906150000 -- unknown, not zero.';
COMMENT ON COLUMN public.shipping_zones.delivery_fee IS
  'Minor units (e.g. kobo/cents), not whole Naira.';
COMMENT ON COLUMN public.shipping_zone_exceptions.delivery_fee IS
  'Minor units (e.g. kobo/cents). NULL = inherit the parent zone''s fee.';
COMMENT ON COLUMN public.store_settings.free_shipping_threshold IS
  'Items subtotal, in minor units, at or above which the delivery fee is waived. 0 disables it.';
COMMENT ON COLUMN public.discounts.value IS
  'PERCENTAGE: 0-100, not money. FIXED: minor units (e.g. kobo/cents). FREE_SHIPPING: always 0, constrained by discounts_free_shipping_value.';
COMMENT ON COLUMN public.discounts.min_order_value IS
  'Minimum items subtotal, in minor units, before this discount applies at all.';
COMMENT ON COLUMN public.discount_redemptions.amount_saved IS
  'What the customer saved, in minor units. Stored rather than recomputed -- the discount''s own value can be edited afterwards.';
COMMENT ON COLUMN public.orders.amount_paid IS
  'Sum of non-rejected order_payments.amount for this order, in minor units, maintained by trigger. Compare with total_amount for the outstanding balance. Never write this directly.';
COMMENT ON COLUMN public.orders.amount_refunded IS
  'Sum of completed order_refunds.amount for this order, in minor units, maintained by trigger. Net received is amount_paid - amount_refunded. Never write this directly.';
COMMENT ON COLUMN public.order_payments.amount IS
  'Minor units actually seen, as read off the receipt -- never the order total. The whole point is that this can differ from what was asked for.';
COMMENT ON COLUMN public.order_refunds.amount IS
  'Minor units going back. Was numeric(12,2) to match order_payments.amount; both are bigint minor units now for the same reason -- a partial refund of an odd total genuinely has fractional-Naira value in it, which minor units represent exactly.';
COMMENT ON COLUMN public.products.pricing_config IS
  'Legacy per-size/colour price and stock maps, superseded by product_variants. Price leaves (sizePrices/colorPrices/combinationPrices) are minor units once _minorUnits is true; stock leaves are unaffected quantities.';

-- ---------------------------------------------------------------------------
-- 8. Recreating the views dropped in step 0
-- ---------------------------------------------------------------------------
-- Verbatim from their own migrations -- nothing about their shape changes,
-- only the type of the columns they read, which Postgres re-derives on its
-- own from the now-bigint source columns.
CREATE OR REPLACE VIEW public.most_wishlisted AS
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.main_image,
    p.stock,
    p.price,
    count(*)::int AS saved_by,
    max(w.created_at) AS last_saved_at
  FROM public.customer_wishlist w
  JOIN public.products p ON p.id = w.product_id
  WHERE p.is_active
  GROUP BY p.id, p.name, p.main_image, p.stock, p.price;

COMMENT ON VIEW public.most_wishlisted IS
  'Active products by how many customers have saved them. Feeds the admin dashboard panel that informs restocking.';

REVOKE ALL ON public.most_wishlisted FROM anon, authenticated;

CREATE OR REPLACE VIEW public.customer_stats
WITH (security_invoker = true) AS
SELECT
  c.id AS customer_id,
  c.email,
  c.full_name,
  c.phone_e164,
  c.is_blocked,
  count(o.id)                                             AS orders_total,
  count(o.id) FILTER (WHERE o.status NOT IN ('pending', 'cancelled'))  AS orders_revenue,
  count(o.id) FILTER (WHERE o.status = 'cancelled')       AS orders_cancelled,
  COALESCE(sum(o.total_amount) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS lifetime_value,
  min(o.created_at)                                       AS first_order_at,
  max(o.created_at)                                       AS last_order_at,
  c.tags,
  COALESCE(sum(o.amount_refunded) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS lifetime_refunded,
  COALESCE(sum(o.total_amount - o.amount_refunded) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS net_lifetime_value
FROM public.customers c
LEFT JOIN public.orders o ON o.customer_id = c.id
GROUP BY c.id, c.email, c.full_name, c.phone_e164, c.is_blocked, c.tags;

COMMENT ON VIEW public.customer_stats IS
  'Per-customer order counts, lifetime value gross and net of refunds, and segment tags. Derived from orders on read so nothing drifts.';

REVOKE ALL ON public.customer_stats FROM anon, authenticated;

CREATE OR REPLACE VIEW public.order_cancellations
WITH (security_invoker = true) AS
SELECT
  o.id                AS order_id,
  o.order_number,
  o.customer_id,
  o.customer_email,
  o.total_amount,
  o.amount_paid,
  o.amount_refunded,
  o.created_at        AS ordered_at,
  h.changed_at        AS cancelled_at,
  h.reason_code,
  h.reason,
  h.actor_email       AS cancelled_by
FROM public.orders o
JOIN LATERAL (
  SELECT s.changed_at, s.reason_code, s.reason, s.actor_email
    FROM public.order_status_history s
   WHERE s.order_id = o.id
     AND s.status = 'cancelled'
   ORDER BY s.changed_at DESC
   LIMIT 1
) h ON true
WHERE o.status = 'cancelled';

COMMENT ON VIEW public.order_cancellations IS
  'Every cancelled order with the ground it was cancelled on, taken from the latest cancelled entry in its status history. Group by reason_code for the breakdown.';

REVOKE ALL ON public.order_cancellations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Functions that type a price/amount column as integer
-- ---------------------------------------------------------------------------
-- Unlike a view, a function does not block ALTER COLUMN TYPE -- nothing above
-- needed this section to push. But six of them declare a RETURNS TABLE column
-- as integer and SELECT straight from a column that is bigint as of step 1;
-- Postgres widens that with an implicit assignment cast today (real prices
-- stay under 2^31), which is a silent, undocumented dependence on every price
-- in this shop staying under roughly 21 million Naira -- not a guarantee this
-- migration's own WHY bigint note makes anywhere else. edit_order_items()
-- computes a line total in a plain integer local and accepts the discount as
-- one, and sync_variants_from_pricing_config() reads a product's price into an
-- integer local before fanning it out to every variant -- all three read
-- values admin-orders.ts already validates up to 10,000,000,000 minor units,
-- so an edit or a save near that ceiling would overflow rather than save.
-- Every one of these is widened to bigint so nothing here is quietly betting
-- on how expensive this shop's baby clothes stay.
--
-- CREATE OR REPLACE FUNCTION cannot change a return type or an argument
-- type -- Postgres treats that as a different function -- so every affected
-- signature is dropped first. Found dynamically by name rather than hand-
-- typed, the same way 20260909120000 already does for this exact trio: a
-- mistyped hand-written signature makes DROP ... IF EXISTS silently do
-- nothing, and the CREATE two statements later then fails with "already
-- exists" -- a worse failure to debug than this migration not being
-- idempotent in the one narrow window between the DROP and the CREATE below.
DO $drop_money_functions$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS signature
             FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname IN (
                'product_candidates', 'count_products', 'list_products',
                'product_cards', 'search_products',
                'storefront_traffic_without_sales', 'edit_order_items'
              )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.signature);
  END LOOP;
END $drop_money_functions$;

-- 9a. product_candidates / count_products / list_products -- verbatim from
-- 20260910120000, the current signatures, with every price parameter and
-- returned column widened from integer to bigint.
CREATE FUNCTION public.product_candidates(
  p_category       TEXT   DEFAULT NULL,
  p_subcategory    TEXT   DEFAULT NULL,
  p_subsubcategory TEXT   DEFAULT NULL,
  p_min_price      BIGINT DEFAULT NULL,
  p_max_price      BIGINT DEFAULT NULL,
  p_sizes          TEXT[] DEFAULT NULL,
  p_colors         TEXT[] DEFAULT NULL,
  p_in_stock_only  BOOLEAN DEFAULT FALSE,
  p_search         TEXT    DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  eff_price bigint,
  units_sold bigint,
  sort_name text,
  sort_created timestamptz,
  is_sold_out boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH search AS (
    SELECT public.build_search_tsquery(p_search) AS tsq
  ),
  variant_agg AS (
    SELECT v.product_id,
           min(v.price) FILTER (WHERE v.price > 0)                        AS agg_min_price,
           array_agg(DISTINCT v.size)  FILTER (WHERE v.size  IS NOT NULL) AS agg_sizes,
           array_agg(DISTINCT v.color) FILTER (WHERE v.color IS NOT NULL) AS agg_colors
      FROM public.product_variants v
     WHERE v.is_active = true
     GROUP BY v.product_id
  )
  SELECT p.id,
         COALESCE(va.agg_min_price, p.price)::bigint,
         COALESCE(ps.units_sold, 0)::bigint,
         p.name,
         p.created_at,
         (p.stock <= 0)
    FROM public.products p
    CROSS JOIN search s
    LEFT JOIN variant_agg          va ON va.product_id = p.id
    LEFT JOIN public.product_sales ps ON ps.product_id = p.id
   WHERE p.is_active = true
     AND (p_category       IS NULL OR p.category         = p_category)
     AND (p_subcategory    IS NULL OR p.sub_category      = p_subcategory)
     AND (p_subsubcategory IS NULL OR p.sub_sub_category  = p_subsubcategory)
     AND (NOT COALESCE(p_in_stock_only, FALSE) OR p.stock > 0)
     AND (p_min_price IS NULL OR COALESCE(va.agg_min_price, p.price) >= p_min_price)
     AND (p_max_price IS NULL OR COALESCE(va.agg_min_price, p.price) <= p_max_price)
     AND (p_sizes  IS NULL OR COALESCE(va.agg_sizes,  p.sizes,  '{}'::text[]) && p_sizes)
     AND (p_colors IS NULL OR COALESCE(va.agg_colors, p.colors, '{}'::text[]) && p_colors)
     AND (s.tsq IS NULL OR p.search_vector @@ s.tsq);
$fn$;

COMMENT ON FUNCTION public.product_candidates IS
  'The single definition of which products match a set of storefront facets, now including an optional sub-subcategory and search predicate. Sold-out products are included and flagged; list_products() ranks them last. Price bounds and eff_price are bigint minor units (20260910130000).';

CREATE FUNCTION public.count_products(
  p_category       TEXT   DEFAULT NULL,
  p_subcategory    TEXT   DEFAULT NULL,
  p_subsubcategory TEXT   DEFAULT NULL,
  p_min_price      BIGINT DEFAULT NULL,
  p_max_price      BIGINT DEFAULT NULL,
  p_sizes          TEXT[] DEFAULT NULL,
  p_colors         TEXT[] DEFAULT NULL,
  p_in_stock_only  BOOLEAN DEFAULT FALSE,
  p_search         TEXT    DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT count(*)::bigint
    FROM public.product_candidates(
      p_category, p_subcategory, p_subsubcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock_only, p_search
    );
$fn$;

COMMENT ON FUNCTION public.count_products IS
  'How many products match a facet set, including sub-subcategory and an in-progress search. Separate from list_products() so "load more" costs one keyset range scan and no counting.';

CREATE FUNCTION public.list_products(
  p_category       TEXT   DEFAULT NULL,
  p_subcategory    TEXT   DEFAULT NULL,
  p_subsubcategory TEXT   DEFAULT NULL,
  p_min_price      BIGINT DEFAULT NULL,
  p_max_price      BIGINT DEFAULT NULL,
  p_sizes          TEXT[] DEFAULT NULL,
  p_colors         TEXT[] DEFAULT NULL,
  p_in_stock_only  BOOLEAN DEFAULT FALSE,
  p_search         TEXT    DEFAULT NULL,
  p_sort           TEXT    DEFAULT 'newest',
  p_limit          INTEGER DEFAULT 24,
  p_cursor_id       UUID        DEFAULT NULL,
  p_cursor_sold_out BOOLEAN     DEFAULT NULL,
  p_cursor_price    BIGINT      DEFAULT NULL,
  p_cursor_sold     BIGINT      DEFAULT NULL,
  p_cursor_name     TEXT        DEFAULT NULL,
  p_cursor_created  TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price bigint,
  category text,
  sub_category text,
  main_image text,
  images text[],
  colors text[],
  stock integer,
  price_min bigint,
  price_max bigint,
  sort_value text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sort  TEXT    := lower(coalesce(p_sort, 'newest'));
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  v_cursor_out BOOLEAN := COALESCE(p_cursor_sold_out, FALSE);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.product_candidates(
      p_category, p_subcategory, p_subsubcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock_only, p_search
    )
  ),
  variant_max AS (
    SELECT v.product_id, max(v.price) AS agg_max_price
      FROM public.product_variants v
      JOIN candidates c ON c.product_id = v.product_id
     WHERE v.is_active = true AND v.price > 0
     GROUP BY v.product_id
  )
  SELECT p.id,
         p.name,
         left(COALESCE(p.description, ''), 200),
         p.price,
         p.category,
         p.sub_category,
         p.main_image,
         p.images,
         p.colors,
         p.stock,
         c.eff_price,
         GREATEST(COALESCE(vm.agg_max_price, c.eff_price), c.eff_price),
         CASE v_sort
           WHEN 'price_asc'    THEN c.eff_price::text
           WHEN 'price_desc'   THEN c.eff_price::text
           WHEN 'best_selling' THEN c.units_sold::text
           WHEN 'name'         THEN c.sort_name
           ELSE c.sort_created::text
         END
    FROM candidates c
    JOIN public.products p ON p.id = c.product_id
    LEFT JOIN variant_max vm ON vm.product_id = c.product_id
   WHERE p_cursor_id IS NULL
      OR (c.is_sold_out AND NOT v_cursor_out)
      OR (c.is_sold_out = v_cursor_out AND (
              (v_sort = 'price_asc'    AND (c.eff_price,    c.product_id) > (p_cursor_price,   p_cursor_id))
           OR (v_sort = 'price_desc'   AND (c.eff_price,    c.product_id) < (p_cursor_price,   p_cursor_id))
           OR (v_sort = 'best_selling' AND (c.units_sold,   c.product_id) < (p_cursor_sold,    p_cursor_id))
           OR (v_sort = 'name'         AND (c.sort_name,    c.product_id) > (p_cursor_name,    p_cursor_id))
           OR (v_sort NOT IN ('price_asc', 'price_desc', 'best_selling', 'name')
                                       AND (c.sort_created, c.product_id) < (p_cursor_created, p_cursor_id))
         ))
   ORDER BY
     c.is_sold_out ASC,
     CASE WHEN v_sort = 'price_asc'    THEN c.eff_price    END ASC,
     CASE WHEN v_sort = 'price_desc'   THEN c.eff_price    END DESC,
     CASE WHEN v_sort = 'best_selling' THEN c.units_sold   END DESC,
     CASE WHEN v_sort = 'name'         THEN c.sort_name    END ASC,
     CASE WHEN v_sort NOT IN ('price_asc', 'price_desc', 'best_selling', 'name')
          THEN c.sort_created END DESC,
     CASE WHEN v_sort IN ('price_asc', 'name') THEN c.product_id END ASC,
     CASE WHEN v_sort NOT IN ('price_asc', 'name') THEN c.product_id END DESC
   LIMIT v_limit;
END;
$fn$;

COMMENT ON FUNCTION public.list_products IS
  'One keyset page of the storefront listing, sold-out products ranked last, now including an optional sub-subcategory and search predicate. The cursor is (is_sold_out, sort key, id) -- pass the previous page''s last row back through p_cursor_sold_out and the typed key column its sort uses. price/price_min/price_max/eff_price are bigint minor units (20260910130000).';

-- 9b. product_cards -- verbatim from 20251101003200, price columns widened.
CREATE FUNCTION public.product_cards(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price bigint,
  category text,
  sub_category text,
  main_image text,
  stock integer,
  price_min bigint,
  price_max bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH wanted AS (
    SELECT u.id, u.ordinality
      FROM unnest(COALESCE(p_ids, '{}'::uuid[])) WITH ORDINALITY AS u(id, ordinality)
  ),
  variant_agg AS (
    SELECT v.product_id,
           min(v.price) FILTER (WHERE v.price > 0) AS agg_min_price,
           max(v.price) FILTER (WHERE v.price > 0) AS agg_max_price
      FROM public.product_variants v
      JOIN wanted w ON w.id = v.product_id
     WHERE v.is_active = true
     GROUP BY v.product_id
  )
  SELECT p.id,
         p.name,
         left(COALESCE(p.description, ''), 200),
         p.price,
         p.category,
         p.sub_category,
         p.main_image,
         p.stock,
         COALESCE(va.agg_min_price, p.price)::bigint,
         GREATEST(COALESCE(va.agg_max_price, p.price), COALESCE(va.agg_min_price, p.price))::bigint
    FROM wanted w
    JOIN public.products p ON p.id = w.id
    LEFT JOIN variant_agg va ON va.product_id = p.id
   WHERE p.is_active = true
   ORDER BY w.ordinality;
$fn$;

COMMENT ON FUNCTION public.product_cards IS
  'Card-shaped rows for a given id list, in the order given. The single definition of what a product card needs; the recommendation functions return ids and let this decide the shape. Price columns are bigint minor units (20260910130000).';

-- 9c. search_products -- verbatim from 20260909120000, price column widened.
CREATE FUNCTION public.search_products(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  price bigint,
  category text,
  sub_category text,
  main_image text,
  stock integer,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery := public.build_search_tsquery(p_query);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_tsquery IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.name, p.price, p.category, p.sub_category, p.main_image, p.stock,
           ts_rank(p.search_vector, v_tsquery) AS rank
      FROM public.products p
     WHERE p.is_active = true
       AND p.search_vector @@ v_tsquery
     ORDER BY rank DESC, p.name ASC
     LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.search_products IS
  'The header typeahead''s search. Query building lives in build_search_tsquery(), which also expands synonyms. price is bigint minor units (20260910130000).';

-- 9d. storefront_traffic_without_sales -- verbatim from 20260908000200, price
-- column widened.
CREATE FUNCTION public.storefront_traffic_without_sales(
  p_window_days integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  main_image text,
  price bigint,
  stock integer,
  views bigint,
  add_to_carts bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH window_events AS (
    SELECT e.product_id, e.event
      FROM public.storefront_events e
     WHERE e.product_id IS NOT NULL
       AND e.ts >= now() - make_interval(days => GREATEST(p_window_days, 1))
  ),
  agg AS (
    SELECT product_id,
           count(*) FILTER (WHERE event = 'view_item')    AS views,
           count(*) FILTER (WHERE event = 'add_to_cart')  AS add_to_carts,
           count(*) FILTER (WHERE event = 'purchase')     AS purchases
      FROM window_events
     GROUP BY product_id
  )
  SELECT p.id, p.name, p.main_image, p.price, p.stock,
         a.views::bigint, a.add_to_carts::bigint
    FROM agg a
    JOIN public.products p ON p.id = a.product_id
   WHERE a.purchases = 0
     AND (a.views > 0 OR a.add_to_carts > 0)
   ORDER BY a.views DESC, a.add_to_carts DESC
   LIMIT GREATEST(p_limit, 1);
$fn$;

COMMENT ON FUNCTION public.storefront_traffic_without_sales IS
  'Products with genuine traffic (a view or an add-to-cart) and zero purchases in the window -- the markdown/featured-slot candidate list that orders alone cannot produce. price is bigint minor units (20260910130000).';

-- 9e. edit_order_items -- verbatim from 20260905190100, every money local and
-- the discount parameter widened. Return type (jsonb) is unchanged, so this
-- one could have used CREATE OR REPLACE, but it was dropped above alongside
-- the rest for one uniform drop-then-create pass.
CREATE FUNCTION public.edit_order_items(
  p_order_id        uuid,
  p_items           jsonb,
  p_tax_rate        numeric,
  p_discount        bigint DEFAULT NULL,
  p_discount_reason text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order      public.orders%ROWTYPE;
  v_old_items  jsonb;
  v_item       jsonb;
  v_quantity   integer;
  v_price      bigint;
  v_subtotal   bigint := 0;
  v_tax        bigint;
  v_discount   bigint;
  v_reason     text;
  v_total      bigint;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'An order id is required.' USING ERRCODE = 'GM003';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'An order must keep at least one line. Cancel it instead of emptying it.'
      USING ERRCODE = 'GM003';
  END IF;

  IF p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 1 THEN
    RAISE EXCEPTION 'The tax rate must be a fraction between 0 and 1.' USING ERRCODE = 'GM003';
  END IF;

  -- Lock the order for the duration. Two admins editing the same order at once
  -- serialise here rather than each computing a total from a snapshot the
  -- other has already replaced.
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'GM003';
  END IF;

  -- A finished order is a record of what happened, not a draft. Editing one
  -- would change an invoice already in somebody's hands and move stock that
  -- physically left the building.
  IF v_order.status IN ('cancelled', 'delivered', 'picked_up') THEN
    RAISE EXCEPTION 'This order is % and can no longer be edited.', v_order.status
      USING ERRCODE = 'GM003';
  END IF;

  -- Validate every line before touching anything, so a bad quantity on the
  -- last line does not leave the first ones already applied.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(btrim(v_item->>'product_name'), '') = '' THEN
      RAISE EXCEPTION 'Every line needs a product name.' USING ERRCODE = 'GM003';
    END IF;

    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 999 THEN
      RAISE EXCEPTION 'Quantity for "%" must be between 1 and 999.', v_item->>'product_name'
        USING ERRCODE = 'GM003';
    END IF;

    v_price := (v_item->>'price')::bigint;
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Price for "%" cannot be negative.', v_item->>'product_name'
        USING ERRCODE = 'GM003';
    END IF;

    v_subtotal := v_subtotal + (v_price * v_quantity);
  END LOOP;

  -- Only orders actually holding inventory move any. A 'pending' order created
  -- before the reservation migration holds none, and releasing what was never
  -- claimed would invent stock.
  IF v_order.stock_reserved THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'product_id', i.product_id,
             'size',       i.size,
             'color',      i.color,
             'quantity',   i.quantity
           )), '[]'::jsonb)
      INTO v_old_items
      FROM public.order_items i
     WHERE i.order_id = p_order_id;

    PERFORM public.adjust_order_stock(v_old_items, false);
    PERFORM public.adjust_order_stock(p_items, true);
  END IF;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity, size, color)
  SELECT p_order_id,
         NULLIF(value->>'product_id', '')::uuid,
         btrim(value->>'product_name'),
         (value->>'price')::bigint,
         (value->>'quantity')::integer,
         NULLIF(btrim(COALESCE(value->>'size', '')), ''),
         NULLIF(btrim(COALESCE(value->>'color', '')), '')
    FROM jsonb_array_elements(p_items);

  -- The delivery fee is deliberately untouched: what is in the box does not
  -- change what the courier charges, and re-quoting the zone here would
  -- silently reprice a delivery the customer already agreed to.
  v_tax      := round(v_subtotal * p_tax_rate)::bigint;
  v_discount := COALESCE(p_discount, v_order.discount_amount);
  v_reason   := CASE WHEN p_discount IS NULL THEN v_order.discount_reason
                     WHEN p_discount = 0     THEN NULL
                     ELSE COALESCE(NULLIF(btrim(p_discount_reason), ''), v_order.discount_reason)
                END;

  IF v_discount < 0 THEN
    RAISE EXCEPTION 'A discount cannot be negative.' USING ERRCODE = 'GM003';
  END IF;

  IF v_discount > v_subtotal + v_tax + v_order.shipping_amount THEN
    RAISE EXCEPTION 'A discount of % is more than the order is worth.', v_discount
      USING ERRCODE = 'GM003';
  END IF;

  v_total := v_subtotal + v_tax + v_order.shipping_amount - v_discount;

  UPDATE public.orders
     SET items_subtotal  = v_subtotal,
         tax_amount      = v_tax,
         discount_amount = v_discount,
         discount_reason = v_reason,
         total_amount    = v_total,
         updated_at      = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'items_subtotal',  v_subtotal,
    'tax_amount',      v_tax,
    'shipping_amount', v_order.shipping_amount,
    'discount_amount', v_discount,
    'discount_reason', v_reason,
    'total_amount',    v_total,
    'previous_total',  v_order.total_amount,
    'stock_adjusted',  v_order.stock_reserved
  );
END;
$fn$;

COMMENT ON FUNCTION public.edit_order_items(uuid, jsonb, numeric, bigint, text) IS
  'Replaces an order''s lines, moves the stock difference and recomputes the total in one transaction. Raises GM003 for bad input and GM001 for an oversell. Every money value is bigint minor units (20260910130000).';

-- Nothing in a browser may call this. Every caller is the server-side
-- service-role client, which is not one of these roles.
REVOKE ALL ON FUNCTION public.edit_order_items(uuid, jsonb, numeric, bigint, text) FROM anon, authenticated;

-- 9f. sync_variants_from_pricing_config -- verbatim from 20251101002600,
-- price local and the pricing_config JSONB price extractions widened. Its
-- signature (uuid in, jsonb out) is unchanged, so CREATE OR REPLACE applies
-- with no DROP -- unlike the six above, nothing about its argument or return
-- type moved.
CREATE OR REPLACE FUNCTION public.sync_variants_from_pricing_config(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg      JSONB;
  v_price    BIGINT;
  v_stock    INTEGER;
  v_active   BOOLEAN;
  v_mode     TEXT;
  v_keys     TEXT[];
  v_count    INTEGER;
BEGIN
  SELECT pricing_config, COALESCE(price, 0), COALESCE(stock, 0), COALESCE(is_active, true)
    INTO v_cfg, v_price, v_stock, v_active
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  v_mode := COALESCE(v_cfg->>'mode', 'single');

  WITH desired AS (
    -- single, and any product with no pricing_config at all
    SELECT NULLIF(btrim(COALESCE(v_cfg->>'singleSize', '')), '')  AS size,
           NULLIF(btrim(COALESCE(v_cfg->>'singleColor', '')), '') AS color,
           v_price AS price,
           GREATEST(COALESCE((v_cfg->>'singleStock')::INTEGER, v_stock, 0), 0) AS stock,
           v_cfg->'colorImages'->>COALESCE(v_cfg->>'singleColor', '') AS image_url
     WHERE v_mode = 'single'

    UNION ALL

    -- combination: keys look like "1-2 months|red"
    SELECT NULLIF(split_part(k.key, '|', 1), ''),
           NULLIF(split_part(k.key, '|', 2), ''),
           COALESCE((v_cfg->'combinationPrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'combinationStock'->>k.key)::INTEGER, 0), 0),
           v_cfg->'colorImages'->>split_part(k.key, '|', 2)
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'combinationPrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'combinationStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'combination' AND NULLIF(btrim(k.key), '') IS NOT NULL

    UNION ALL

    -- size only
    SELECT k.key, NULL,
           COALESCE((v_cfg->'sizePrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'sizeStock'->>k.key)::INTEGER, 0), 0),
           NULL
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'sizePrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'sizeStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'size' AND NULLIF(btrim(k.key), '') IS NOT NULL

    UNION ALL

    -- color only
    SELECT NULL, k.key,
           COALESCE((v_cfg->'colorPrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'colorStock'->>k.key)::INTEGER, 0), 0),
           v_cfg->'colorImages'->>k.key
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'colorPrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'colorStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'color' AND NULLIF(btrim(k.key), '') IS NOT NULL
  ), upserted AS (
    INSERT INTO public.product_variants (product_id, size, color, price, stock, image_url, is_active)
    SELECT p_product_id, d.size, d.color, d.price, d.stock, d.image_url, v_active
      FROM desired d
    ON CONFLICT (product_id, variant_key) DO UPDATE
      -- price/stock/image follow the config. sku, barcode and cost are NOT
      -- touched: nothing in the pricing_config model can express them, so a
      -- save from the old form must not wipe values entered elsewhere.
      SET price      = EXCLUDED.price,
          stock      = EXCLUDED.stock,
          image_url  = COALESCE(EXCLUDED.image_url, public.product_variants.image_url),
          is_active  = EXCLUDED.is_active,
          updated_at = now()
    RETURNING variant_key
  )
  SELECT array_agg(variant_key) INTO v_keys FROM upserted;

  v_keys := COALESCE(v_keys, ARRAY[]::TEXT[]);

  -- Variants the admin removed from the config. Guarded so a config that
  -- produced nothing at all (a malformed save) cannot wipe a product's stock.
  IF array_length(v_keys, 1) > 0 THEN
    DELETE FROM public.product_variants
     WHERE product_id = p_product_id
       AND NOT (variant_key = ANY (v_keys));
  END IF;

  SELECT count(*) INTO v_count FROM public.product_variants WHERE product_id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variants', v_count);
END;
$$;

COMMENT ON FUNCTION public.sync_variants_from_pricing_config(uuid) IS
  'Derives product_variants rows from a product pricing_config. Called by the migration backfill and by the admin product save, so the rule has one implementation. Price values are bigint minor units (20260910130000).';

-- 9g. replace_product_variants -- verbatim from 20251101002600, price/cost
-- extraction widened. Unreferenced by any application code today (checked:
-- no .rpc('replace_product_variants', ...) call anywhere in app/ or lib/),
-- but it carries no REVOKE either, so it is callable and worth being correct
-- rather than a trap for whatever reaches for it next. Signature and return
-- type are unchanged -- CREATE OR REPLACE, no DROP.
CREATE OR REPLACE FUNCTION public.replace_product_variants(
  p_product_id UUID,
  p_variants   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys TEXT[];
  v_kept INTEGER;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'replace_product_variants requires a product id' USING ERRCODE = 'GM003';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'replace_product_variants requires an array of variants' USING ERRCODE = 'GM003';
  END IF;

  -- An empty array would fall through to the DELETE below and remove every
  -- variant, zeroing the product's stock. No legitimate save wants that, and a
  -- form bug that submitted nothing would silently wipe inventory, so refuse
  -- it rather than obey it.
  IF jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'A product must keep at least one variant.' USING ERRCODE = 'GM003';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  WITH incoming AS (
    SELECT
      NULLIF(btrim(COALESCE(i->>'size',  '')), '') AS size,
      NULLIF(btrim(COALESCE(i->>'color', '')), '') AS color,
      GREATEST(COALESCE((i->>'price')::BIGINT, 0), 0)  AS price,
      GREATEST(COALESCE((i->>'stock')::INTEGER, 0), 0)  AS stock,
      NULLIF(btrim(COALESCE(i->>'sku',       '')), '') AS sku,
      NULLIF(btrim(COALESCE(i->>'barcode',   '')), '') AS barcode,
      NULLIF(btrim(COALESCE(i->>'image_url', '')), '') AS image_url,
      CASE WHEN (i->>'cost') IS NULL THEN NULL
           ELSE GREATEST((i->>'cost')::BIGINT, 0) END AS cost,
      COALESCE((i->>'is_active')::BOOLEAN, true)        AS is_active,
      i.ordinality
    FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS i(value, ordinality)
  ), deduped AS (
    -- Two rows for one combination would violate the unique index. Keep the
    -- last, matching how a later entry in the form wins — which needs the
    -- explicit ordinality below, because DISTINCT ON without a tiebreaker
    -- keeps an arbitrary row rather than a predictable one.
    SELECT DISTINCT ON (public.variant_key(size, color))
           size, color, price, stock, sku, barcode, image_url, cost, is_active
      FROM incoming
     ORDER BY public.variant_key(size, color), ordinality DESC
  ), upserted AS (
    INSERT INTO public.product_variants
      (product_id, size, color, price, stock, sku, barcode, image_url, cost, is_active)
    SELECT p_product_id, size, color, price, stock, sku, barcode, image_url, cost, is_active
      FROM deduped
    ON CONFLICT (product_id, variant_key) DO UPDATE
      SET size      = EXCLUDED.size,
          color     = EXCLUDED.color,
          price     = EXCLUDED.price,
          stock     = EXCLUDED.stock,
          sku       = EXCLUDED.sku,
          barcode   = EXCLUDED.barcode,
          image_url = EXCLUDED.image_url,
          cost      = EXCLUDED.cost,
          is_active = EXCLUDED.is_active
    RETURNING variant_key
  )
  SELECT array_agg(variant_key) INTO v_keys FROM upserted;

  v_keys := COALESCE(v_keys, ARRAY[]::TEXT[]);

  -- Guarded for the same reason as the length check above: `NOT (x = ANY('{}'))`
  -- is true for every row, so an empty key set here would delete them all.
  IF array_length(v_keys, 1) > 0 THEN
    DELETE FROM public.product_variants
     WHERE product_id = p_product_id
       AND NOT (variant_key = ANY (v_keys));
  END IF;

  SELECT count(*) INTO v_kept FROM public.product_variants WHERE product_id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variants', v_kept);
END;
$$;

COMMENT ON FUNCTION public.replace_product_variants(uuid, jsonb) IS
  'Bulk-replaces a product''s variant rows from an explicit array. Price/cost values are bigint minor units (20260910130000).';
