-- ============================================================================
-- Recommendations: related products, co-purchase pairs, recently viewed
-- ----------------------------------------------------------------------------
-- There was no recommendation surface anywhere. No related products on a
-- product page, no cross-sell in the cart, no recently viewed. Every session
-- was single-product, which keeps average order value at one item — brutal
-- when a delivery fee is attached per order, because bundling is the only way
-- the shop and the customer both win on shipping.
--
-- Nothing here is machine learning, and it does not need to be. Two honest
-- heuristics and a list the browser already has beat nothing by a distance:
--
--   * Same subcategory, widening to the category. Someone looking at a
--     newborn sleepsuit is plausibly interested in another one.
--   * Genuine co-purchase, counted from orders that were actually paid for.
--   * Recently viewed, which is not a recommendation at all — it is the
--     shopper's own history handed back to them, and it converts because they
--     already chose those products once.
--
-- ONE PROJECTION, THREE SURFACES
--
-- product_cards() is the only place that says what a card needs. The three
-- recommendation functions return ids and a rank; the card shape is looked up
-- once. Repeating that column list per surface is three things to keep in step
-- with ProductCard, and eventually one of them would not be.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. What gets bought together
-- ---------------------------------------------------------------------------
-- Directed pairs: (a -> b) and (b -> a) are both stored, so a lookup for one
-- product is an index seek rather than an OR across two columns.
CREATE TABLE IF NOT EXISTS public.product_pairs (
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  /** Distinct orders containing both. Not item rows — a single order that
   *  listed the same product twice is one piece of evidence, not two. */
  co_purchase_count integer NOT NULL CHECK (co_purchase_count > 0),
  computed_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (product_id, related_product_id),
  CONSTRAINT product_pairs_distinct CHECK (product_id <> related_product_id)
);

CREATE INDEX IF NOT EXISTS product_pairs_lookup_idx
  ON public.product_pairs (product_id, co_purchase_count DESC);

COMMENT ON TABLE public.product_pairs IS
  'Co-purchase counts, rebuilt nightly by rebuild_product_pairs(). Derived data — safe to truncate, it will come back on the next run.';

-- Derived from the order tables, so it inherits their access rules: nothing
-- reads it from the browser, only the SECURITY DEFINER function below.
ALTER TABLE public.product_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_pairs FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The nightly rebuild
-- ---------------------------------------------------------------------------
-- Full recompute rather than an incremental update. The table is small, the
-- job runs once a day, and a recompute cannot drift — an incremental version
-- would need to know which orders it had already counted, which is a piece of
-- state that eventually disagrees with reality.
CREATE OR REPLACE FUNCTION public.rebuild_product_pairs(p_min_orders INTEGER DEFAULT 1)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_written bigint;
  -- 1 by default: on a catalogue this size a single shared order is the only
  -- signal there is, and demanding three would leave the table empty. Raise it
  -- as the order book grows and the pairs start looking like coincidence.
  v_min INTEGER := GREATEST(COALESCE(p_min_orders, 1), 1);
BEGIN
  -- DELETE rather than TRUNCATE: this runs inside the caller's transaction, and
  -- a TRUNCATE would take an ACCESS EXCLUSIVE lock that blocks every reader for
  -- the length of the rebuild.
  DELETE FROM public.product_pairs;

  INSERT INTO public.product_pairs (product_id, related_product_id, co_purchase_count, computed_at)
  SELECT a.product_id,
         b.product_id,
         count(DISTINCT a.order_id)::integer,
         now()
    FROM public.order_items a
    JOIN public.order_items b
      ON b.order_id = a.order_id
     AND b.product_id <> a.product_id
    JOIN public.orders o ON o.id = a.order_id
   -- Mirrors REVENUE_STATUSES: a pending order is not a purchase, and counting
   -- it would let anyone seed the recommendations by placing orders they never
   -- pay for.
   WHERE o.status NOT IN ('pending', 'cancelled')
     AND a.product_id IS NOT NULL
     AND b.product_id IS NOT NULL
   GROUP BY a.product_id, b.product_id
  HAVING count(DISTINCT a.order_id) >= v_min;

  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$fn$;

COMMENT ON FUNCTION public.rebuild_product_pairs IS
  'Recomputes product_pairs from paid orders. Called nightly by /api/cron/product-pairs. Full recompute — it cannot drift.';

-- ---------------------------------------------------------------------------
-- 3. The shared card projection
-- ---------------------------------------------------------------------------
-- Same shape list_products() returns, so every surface can hand rows straight
-- to ProductCard. Input order is preserved through WITH ORDINALITY, because the
-- ranking is decided by the caller and an unordered result would throw it away.
CREATE OR REPLACE FUNCTION public.product_cards(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price integer,
  category text,
  sub_category text,
  main_image text,
  stock integer,
  price_min integer,
  price_max integer
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
         COALESCE(va.agg_min_price, p.price)::integer,
         GREATEST(COALESCE(va.agg_max_price, p.price), COALESCE(va.agg_min_price, p.price))::integer
    FROM wanted w
    JOIN public.products p ON p.id = w.id
    LEFT JOIN variant_agg va ON va.product_id = p.id
   -- A product deactivated since it was viewed or co-purchased simply drops
   -- out. That is why is_active is checked here and not at build time.
   WHERE p.is_active = true
   ORDER BY w.ordinality;
$fn$;

COMMENT ON FUNCTION public.product_cards IS
  'Card-shaped rows for a given id list, in the order given. The single definition of what a product card needs; the recommendation functions return ids and let this decide the shape.';

-- ---------------------------------------------------------------------------
-- 4. "You might also like" — same subcategory, widening to the category
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.related_product_ids(
  p_product_id uuid,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (product_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH source AS (
    SELECT p.category, p.sub_category
      FROM public.products p
     WHERE p.id = p_product_id
  )
  SELECT p.id
    FROM public.products p
    CROSS JOIN source s
   WHERE p.is_active = true
     AND p.id <> p_product_id
     AND p.category = s.category
   ORDER BY
     -- Same subcategory first; the wider category is the fallback, not an
     -- equal. A christening gown next to another christening gown is a better
     -- suggestion than one next to a bib.
     (p.sub_category IS NOT DISTINCT FROM s.sub_category) DESC,
     -- Then what can actually be bought. Recommending a sold-out product is
     -- offering someone a second dead end.
     (p.stock > 0) DESC,
     p.created_at DESC
   LIMIT GREATEST(COALESCE(p_limit, 8), 1);
$fn$;

COMMENT ON FUNCTION public.related_product_ids IS
  'Same-subcategory suggestions for a product page, widening to the category. Sold-out products rank last rather than being excluded — the catalogue is small enough that dropping them can leave the rail empty.';

-- ---------------------------------------------------------------------------
-- 5. "Customers also bought" — for the cart
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.co_purchased_product_ids(
  p_product_ids uuid[],
  p_limit INTEGER DEFAULT 4
)
RETURNS TABLE (product_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT pp.related_product_id
    FROM public.product_pairs pp
    JOIN public.products p ON p.id = pp.related_product_id
   WHERE pp.product_id = ANY(COALESCE(p_product_ids, '{}'::uuid[]))
     -- Never suggest something already in the cart.
     AND NOT (pp.related_product_id = ANY(COALESCE(p_product_ids, '{}'::uuid[])))
     AND p.is_active = true
     -- Here, unlike the product page, sold-out really is excluded: the whole
     -- point of a cart cross-sell is adding it to this order.
     AND p.stock > 0
   GROUP BY pp.related_product_id
   -- Summed across every cart line, so a product paired with two of the items
   -- outranks one paired with a single item more often.
   ORDER BY sum(pp.co_purchase_count) DESC, pp.related_product_id
   LIMIT GREATEST(COALESCE(p_limit, 4), 1);
$fn$;

COMMENT ON FUNCTION public.co_purchased_product_ids IS
  'Products bought alongside what is in the cart, from product_pairs. Excludes the cart contents and anything sold out.';
