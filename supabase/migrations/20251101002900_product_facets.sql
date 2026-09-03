-- ============================================================================
-- Product faceting and sorting
-- ----------------------------------------------------------------------------
-- CategoryFilterSidebar was titled "Filters" but offered only category and
-- subcategory, and useProductsListing always ordered by created_at desc with no
-- alternative. A parent shopping for a two-year-old could not narrow to age 2,
-- and nobody could shop to a budget. The hook even carried a `showOutOfStock`
-- state variable with no setter and no UI — the intent was there, unfinished.
--
-- WHY THIS IS SERVER-SIDE
--
-- Two of the facets cannot be answered in the browser:
--
--   * Best-selling needs order_items, and 20251101001700 took anon's read on
--     the order tables away — correctly. A SECURITY DEFINER function is the
--     only way the storefront learns how many of something sold without also
--     being able to read who bought it.
--   * Size and colour are per-variant. products.sizes/colors is the legacy
--     copy the admin form still writes; product_variants is what is actually
--     sellable, and a size whose only variant is deactivated should not appear
--     as an option.
--
-- ON-SALE IS DELIBERATELY NOT HERE. Which discount applies to a product is
-- decided by getBestDiscount() in lib/commerce/discounts.ts — scope precedence,
-- date windows, variant targets. Reimplementing that in PL/pgSQL would create a
-- second answer to the same question, and the two would drift. /api/products
-- applies that facet itself, in TypeScript, calling the same function the
-- ProductCard badge calls — before it pages, so a page is never short.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Units sold
-- ---------------------------------------------------------------------------
-- order_items has an index on order_id but none on product_id, so aggregating
-- by product was a sequential scan.
CREATE INDEX IF NOT EXISTS order_items_product_id_idx
  ON public.order_items (product_id)
  WHERE product_id IS NOT NULL;

-- Mirrors REVENUE_STATUSES in lib/commerce/order-status.ts: everything except
-- 'pending' (payment not yet verified) and 'cancelled' (never fulfilled). A
-- pending order is not a sale, and counting it would let anyone inflate a
-- product's ranking by placing orders they never pay for.
CREATE OR REPLACE VIEW public.product_sales AS
  SELECT oi.product_id,
         sum(oi.quantity)::bigint AS units_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE oi.product_id IS NOT NULL
     AND o.status NOT IN ('pending', 'cancelled')
   GROUP BY oi.product_id;

COMMENT ON VIEW public.product_sales IS
  'Units sold per product across non-pending, non-cancelled orders. Read only through list_products(); anon has no grant, because reaching it directly would expose order data.';

-- The view reads the order tables, which anon must not reach by any route.
REVOKE ALL ON public.product_sales FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The listing query
-- ---------------------------------------------------------------------------
-- One function serves every combination of facet and sort, so the storefront
-- cannot assemble a filter the server has not agreed to. NULL means "this facet
-- is not applied" throughout; an empty array would be ambiguous.
CREATE OR REPLACE FUNCTION public.list_products(
  p_category    TEXT    DEFAULT NULL,
  p_subcategory TEXT    DEFAULT NULL,
  p_min_price   INTEGER DEFAULT NULL,
  p_max_price   INTEGER DEFAULT NULL,
  p_sizes       TEXT[]  DEFAULT NULL,
  p_colors      TEXT[]  DEFAULT NULL,
  p_in_stock    BOOLEAN DEFAULT TRUE,
  p_sort        TEXT    DEFAULT 'newest',
  p_limit       INTEGER DEFAULT 24,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price integer,
  category text,
  sub_category text,
  main_image text,
  images text[],
  colors text[],
  sizes text[],
  details text[],
  stock integer,
  is_active boolean,
  sizing_type text,
  pricing_config jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  effective_price integer,
  units_sold bigint,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sort   TEXT    := lower(coalesce(p_sort, 'newest'));
  -- 100 rather than a page's 24: /api/products scans wider than one page when
  -- the on-sale facet is on, because whether a product is discounted is decided
  -- in TypeScript and so cannot be part of this query's WHERE clause.
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN QUERY
  WITH variant_agg AS (
    -- Only active variants: a discontinued colour is not a colour you can buy.
    -- Aliased away from 'sizes'/'colors': those are RETURNS TABLE output
    -- parameters, which PL/pgSQL treats as variables in scope for the whole
    -- body, and a column of the same name is a resolution ambiguity waiting to
    -- surface as a runtime error.
    SELECT v.product_id,
           min(v.price) FILTER (WHERE v.price > 0)                        AS agg_min_price,
           array_agg(DISTINCT v.size)  FILTER (WHERE v.size  IS NOT NULL) AS agg_sizes,
           array_agg(DISTINCT v.color) FILTER (WHERE v.color IS NOT NULL) AS agg_colors
      FROM public.product_variants v
     WHERE v.is_active = true
     GROUP BY v.product_id
  ),
  matched AS (
    SELECT p.*,
           -- What the shopper would actually pay at the cheapest variant. A
           -- product listed at 12,000 whose small is 6,500 belongs in the
           -- "under 10,000" band, because that is the truthful answer to
           -- "can I afford this".
           COALESCE(va.agg_min_price, p.price) AS eff_price,
           COALESCE(ps.units_sold, 0)          AS sold
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
       -- The cast is not decoration — an untyped '{}' has no element type to
       -- match against text[] and the operator will not resolve.
       AND (p_sizes  IS NULL OR COALESCE(va.agg_sizes,  p.sizes,  '{}'::text[]) && p_sizes)
       AND (p_colors IS NULL OR COALESCE(va.agg_colors, p.colors, '{}'::text[]) && p_colors)
  )
  SELECT m.id, m.name, m.description, m.price, m.category, m.sub_category,
         m.main_image, m.images, m.colors, m.sizes, m.details, m.stock,
         m.is_active, m.sizing_type, m.pricing_config, m.created_at, m.updated_at,
         m.eff_price,
         m.sold,
         -- The count before paging, carried on every row: one round trip
         -- instead of two, and it can never disagree with the page it
         -- describes.
         count(*) OVER () AS total_count
    FROM matched m
   ORDER BY
     CASE WHEN v_sort = 'price_asc'    THEN m.eff_price END ASC,
     CASE WHEN v_sort = 'price_desc'   THEN m.eff_price END DESC,
     CASE WHEN v_sort = 'best_selling' THEN m.sold      END DESC,
     CASE WHEN v_sort = 'name'         THEN m.name      END ASC,
     -- Also the tiebreaker for every other sort, so paging stays stable when
     -- two products share a price or a sales count.
     m.created_at DESC
   LIMIT v_limit OFFSET v_offset;
END;
$fn$;

COMMENT ON FUNCTION public.list_products IS
  'Faceted, sorted storefront listing. NULL means a facet is not applied. Runs as definer only to read product_sales; it returns no order data.';

-- ---------------------------------------------------------------------------
-- 3. Which facet options actually exist
-- ---------------------------------------------------------------------------
-- Scoped by category only, never by the other facets. If picking "Blue" pruned
-- the size list to sizes that come in blue, a shopper who then wanted size 2
-- would find it missing and conclude the store has none.
CREATE OR REPLACE FUNCTION public.product_facet_options(
  p_category    TEXT DEFAULT NULL,
  p_subcategory TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH scoped AS (
    SELECT p.id, p.price, p.sizes, p.colors
      FROM public.products p
     WHERE p.is_active = true
       AND p.stock > 0
       AND (p_category    IS NULL OR p.category     = p_category)
       AND (p_subcategory IS NULL OR p.sub_category = p_subcategory)
  ),
  variants AS (
    SELECT v.product_id, v.size, v.color, v.price
      FROM public.product_variants v
      JOIN scoped s ON s.id = v.product_id
     WHERE v.is_active = true
  ),
  -- A product with no variant rows still has the legacy products.sizes array,
  -- and its sizes are real. A product that does have variants is described
  -- entirely by them.
  size_values AS (
    SELECT v.size AS value FROM variants v WHERE v.size IS NOT NULL
    UNION
    SELECT u.value FROM scoped s
     CROSS JOIN LATERAL unnest(s.sizes) AS u(value)
     WHERE NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = s.id)
  ),
  color_values AS (
    SELECT v.color AS value FROM variants v WHERE v.color IS NOT NULL
    UNION
    SELECT u.value FROM scoped s
     CROSS JOIN LATERAL unnest(s.colors) AS u(value)
     WHERE NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = s.id)
  ),
  prices AS (
    SELECT COALESCE(
             (SELECT min(v.price) FROM variants v WHERE v.product_id = s.id AND v.price > 0),
             s.price
           ) AS value
      FROM scoped s
  )
  SELECT jsonb_build_object(
    'sizes',    COALESCE((SELECT jsonb_agg(value ORDER BY value) FROM size_values  WHERE value IS NOT NULL AND btrim(value) <> ''), '[]'::jsonb),
    'colors',   COALESCE((SELECT jsonb_agg(value ORDER BY value) FROM color_values WHERE value IS NOT NULL AND btrim(value) <> ''), '[]'::jsonb),
    'minPrice', COALESCE((SELECT min(value) FROM prices), 0),
    'maxPrice', COALESCE((SELECT max(value) FROM prices), 0)
  );
$fn$;

COMMENT ON FUNCTION public.product_facet_options IS
  'Size, colour and price bounds that exist within a category scope, so the sidebar never offers a filter that matches nothing.';
