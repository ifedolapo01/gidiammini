-- ============================================================================
-- Product listing: keyset paging and a card-sized payload
-- ----------------------------------------------------------------------------
-- 20251101002900 gave the listing its facets but kept two problems from the
-- original client-side `select('*')`:
--
--   1. It returned every column. `description`, `images`, `colors`, `sizes`,
--      `details` and the whole `pricing_config` JSONB travelled to the browser
--      on every card, and the card renders none of them except a two-line
--      description. On mobile data that is the slowest part of the page.
--   2. It paged with LIMIT/OFFSET. OFFSET makes the database walk and discard
--      every row it skips, so page 10 costs ten pages of work — and if a
--      product is added while someone is paging, rows shift and they see a
--      duplicate or miss one.
--
-- WHAT REPLACES THEM
--
-- `product_candidates()` is the single definition of "which products match
-- these facets", and both of the functions below are built on it. That matters
-- because the alternative — repeating the WHERE clause in a list function and
-- a count function — is two things that must stay identical and eventually
-- will not.
--
-- `list_products()` now returns only what ProductCard draws, plus the variant
-- price range it used to recompute from pricing_config in the browser. Paging
-- is keyset: "everything after this (sort key, id)", which costs the same on
-- page 40 as on page 1 and cannot skip or repeat a row when the catalogue
-- changes underneath.
--
-- The cursor is deliberately spread across typed parameters rather than one
-- text value cast per sort. A single `p_cursor::integer` inside a CASE can be
-- constant-folded by the planner even when its branch is not taken, so sorting
-- by name with a name-shaped cursor would fail trying to read it as an integer.
--
-- `units_sold` is NOT returned. It is needed to page a best-selling sort, but
-- it is also a public statement of how much the store sells, so /api/products
-- keeps it server-side: the row carries an opaque `sort_value`, the route turns
-- that into a cursor, and it never reaches the browser.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Indexes for the sorts that can use one
-- ---------------------------------------------------------------------------
-- Partial on is_active because the storefront never asks for anything else,
-- and the tiebreaker column is in the index so the keyset comparison is a
-- range scan rather than a sort.
CREATE INDEX IF NOT EXISTS products_active_created_idx
  ON public.products (created_at DESC, id DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS products_active_name_idx
  ON public.products (name ASC, id ASC)
  WHERE is_active = true;

-- Price and best-selling sort on computed values (cheapest active variant, and
-- a join to product_sales), so no index on products can serve them. They fall
-- back to a sort over the matched set, which is bounded by the facets.

-- ---------------------------------------------------------------------------
-- 2. What matches — the one definition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_candidates(
  p_category    TEXT    DEFAULT NULL,
  p_subcategory TEXT    DEFAULT NULL,
  p_min_price   INTEGER DEFAULT NULL,
  p_max_price   INTEGER DEFAULT NULL,
  p_sizes       TEXT[]  DEFAULT NULL,
  p_colors      TEXT[]  DEFAULT NULL,
  p_in_stock    BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  product_id uuid,
  eff_price integer,
  units_sold bigint,
  sort_name text,
  sort_created timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH variant_agg AS (
    -- Only active variants: a discontinued colour is not a colour you can buy.
    SELECT v.product_id,
           min(v.price) FILTER (WHERE v.price > 0)                        AS agg_min_price,
           array_agg(DISTINCT v.size)  FILTER (WHERE v.size  IS NOT NULL) AS agg_sizes,
           array_agg(DISTINCT v.color) FILTER (WHERE v.color IS NOT NULL) AS agg_colors
      FROM public.product_variants v
     WHERE v.is_active = true
     GROUP BY v.product_id
  )
  SELECT p.id,
         -- What the shopper would actually pay at the cheapest variant.
         COALESCE(va.agg_min_price, p.price)::integer,
         COALESCE(ps.units_sold, 0)::bigint,
         p.name,
         p.created_at
    FROM public.products p
    LEFT JOIN variant_agg          va ON va.product_id = p.id
    LEFT JOIN public.product_sales ps ON ps.product_id = p.id
   WHERE p.is_active = true
     AND (p_category    IS NULL OR p.category     = p_category)
     AND (p_subcategory IS NULL OR p.sub_category = p_subcategory)
     AND (NOT COALESCE(p_in_stock, TRUE) OR p.stock > 0)
     AND (p_min_price IS NULL OR COALESCE(va.agg_min_price, p.price) >= p_min_price)
     AND (p_max_price IS NULL OR COALESCE(va.agg_min_price, p.price) <= p_max_price)
     -- && is "overlaps": keep the product if it offers any requested size.
     AND (p_sizes  IS NULL OR COALESCE(va.agg_sizes,  p.sizes,  '{}'::text[]) && p_sizes)
     AND (p_colors IS NULL OR COALESCE(va.agg_colors, p.colors, '{}'::text[]) && p_colors);
$fn$;

COMMENT ON FUNCTION public.product_candidates IS
  'The single definition of which products match a set of storefront facets. list_products() and count_products() are both built on it so the two can never disagree about what matches.';

-- ---------------------------------------------------------------------------
-- 3. How many match
-- ---------------------------------------------------------------------------
-- Called only for the first page. Every "load more" after that already knows
-- the total and asks for rows alone.
CREATE OR REPLACE FUNCTION public.count_products(
  p_category    TEXT    DEFAULT NULL,
  p_subcategory TEXT    DEFAULT NULL,
  p_min_price   INTEGER DEFAULT NULL,
  p_max_price   INTEGER DEFAULT NULL,
  p_sizes       TEXT[]  DEFAULT NULL,
  p_colors      TEXT[]  DEFAULT NULL,
  p_in_stock    BOOLEAN DEFAULT TRUE
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT count(*)::bigint
    FROM public.product_candidates(
      p_category, p_subcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock
    );
$fn$;

COMMENT ON FUNCTION public.count_products IS
  'How many products match a facet set. Separate from list_products() so a "load more" costs one keyset range scan and no counting.';

-- ---------------------------------------------------------------------------
-- 4. The page itself
-- ---------------------------------------------------------------------------
-- The return type changes (card fields only, no total_count), and a function's
-- result type cannot be replaced in place — so every existing overload goes
-- first, by name, whether or not 20251101002900 has been applied here.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS signature
             FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'list_products'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.signature);
  END LOOP;
END $$;

CREATE FUNCTION public.list_products(
  p_category    TEXT    DEFAULT NULL,
  p_subcategory TEXT    DEFAULT NULL,
  p_min_price   INTEGER DEFAULT NULL,
  p_max_price   INTEGER DEFAULT NULL,
  p_sizes       TEXT[]  DEFAULT NULL,
  p_colors      TEXT[]  DEFAULT NULL,
  p_in_stock    BOOLEAN DEFAULT TRUE,
  p_sort        TEXT    DEFAULT 'newest',
  p_limit       INTEGER DEFAULT 24,
  -- The keyset cursor: the sort key of the last row of the previous page, in
  -- whichever column that sort uses, plus its id to break ties.
  p_cursor_id      UUID        DEFAULT NULL,
  p_cursor_price   INTEGER     DEFAULT NULL,
  p_cursor_sold    BIGINT      DEFAULT NULL,
  p_cursor_name    TEXT        DEFAULT NULL,
  p_cursor_created TIMESTAMPTZ DEFAULT NULL
)
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
  price_max integer,
  -- The cursor half the caller needs to ask for the next page, as text so one
  -- column serves every sort. /api/products consumes it and strips it.
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
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.product_candidates(
      p_category, p_subcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock
    )
  ),
  -- The dearest active variant, for the "from X to Y" range on the card. Only
  -- the cheapest is needed to filter, so it lives in product_candidates; this
  -- is presentation and stays here.
  variant_max AS (
    SELECT v.product_id, max(v.price) AS agg_max_price
      FROM public.product_variants v
      JOIN candidates c ON c.product_id = v.product_id
     WHERE v.is_active = true AND v.price > 0
     GROUP BY v.product_id
  )
  SELECT p.id,
         p.name,
         -- The card clamps this to two lines. Sending a 4,000-character
         -- description so CSS can hide 95% of it is most of the payload.
         left(COALESCE(p.description, ''), 200),
         p.price,
         p.category,
         p.sub_category,
         p.main_image,
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
      -- Row-value comparison, so "after this key, or the same key and a later
      -- id" is one expression the index can drive. Each branch's tiebreaker
      -- runs the same direction as its sort key, which is what keeps the
      -- comparison a single range.
      OR (v_sort = 'price_asc'    AND (c.eff_price,   c.product_id) > (p_cursor_price,   p_cursor_id))
      OR (v_sort = 'price_desc'   AND (c.eff_price,   c.product_id) < (p_cursor_price,   p_cursor_id))
      OR (v_sort = 'best_selling' AND (c.units_sold,  c.product_id) < (p_cursor_sold,    p_cursor_id))
      OR (v_sort = 'name'         AND (c.sort_name,   c.product_id) > (p_cursor_name,    p_cursor_id))
      OR (v_sort NOT IN ('price_asc', 'price_desc', 'best_selling', 'name')
                                  AND (c.sort_created, c.product_id) < (p_cursor_created, p_cursor_id))
   ORDER BY
     CASE WHEN v_sort = 'price_asc'    THEN c.eff_price    END ASC,
     CASE WHEN v_sort = 'price_desc'   THEN c.eff_price    END DESC,
     CASE WHEN v_sort = 'best_selling' THEN c.units_sold   END DESC,
     CASE WHEN v_sort = 'name'         THEN c.sort_name    END ASC,
     CASE WHEN v_sort NOT IN ('price_asc', 'price_desc', 'best_selling', 'name')
          THEN c.sort_created END DESC,
     -- The id tiebreaker, in whichever direction this sort runs. Without it
     -- two products at the same price have no stable order and a keyset page
     -- boundary can drop one.
     CASE WHEN v_sort IN ('price_asc', 'name') THEN c.product_id END ASC,
     CASE WHEN v_sort NOT IN ('price_asc', 'name') THEN c.product_id END DESC
   LIMIT v_limit;
END;
$fn$;

COMMENT ON FUNCTION public.list_products IS
  'One keyset page of the storefront listing, carrying only the fields ProductCard draws. Pass the previous page''s last sort_value and id as the cursor. Deliberately does not return units_sold — see /api/products.';
