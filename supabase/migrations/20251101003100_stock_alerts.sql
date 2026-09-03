-- ============================================================================
-- Sold-out products stay on the shelf, and can be waited for
-- ----------------------------------------------------------------------------
-- The listing applied `stock > 0`, so a sold-out product left the catalogue
-- entirely. That threw away three things at once:
--
--   * The indexed page and whatever ranking it had accumulated. A URL that
--     starts returning nothing is a URL that stops being ranked.
--   * The demand signal. A product people keep opening while it is unbuyable
--     is the clearest restock instruction the store will ever get, and it was
--     invisible.
--   * Its own out-of-stock UI. OutOfStockNotice and StockBadge's SOLD OUT
--     label already existed on the product page — and almost nobody could
--     reach them, because the filter removed the only route there.
--
-- WHAT CHANGES
--
-- `p_in_stock` becomes `p_in_stock_only` and defaults to FALSE: sold-out
-- products are returned by default and ranked last, rather than removed. The
-- filter survives as an explicit shopper choice.
--
-- Ranking last is a change to the sort key, which means it is also a change to
-- the keyset cursor — the cursor has to carry which block the last row was in,
-- or paging would jump back to the in-stock section. is_sold_out sorts ASC
-- (false first) while most sorts run DESC, and a row-value comparison needs one
-- direction throughout, so the cursor predicate is two-level: past the block, or
-- same block and past the key.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who wants to hear when it is back
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  /**
   * The variant they were looking at, when they were looking at one. Null for
   * a whole-product alert, which is what the out-of-stock notice raises — the
   * notice only appears once every variant is gone.
   */
  variant_key text,

  email text NOT NULL,

  /** Set when the restock mail goes out. Null means still waiting. */
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Format-checked here as well as in the API, because a row that reaches the
  -- table by any other route still has to be mailable.
  CONSTRAINT stock_alerts_email_shape CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- One live request per person per product. Asking twice while waiting is one
-- request, not two emails; once notified, the row is spent and the same person
-- may ask again for the next time it sells out.
CREATE UNIQUE INDEX IF NOT EXISTS stock_alerts_pending_unique_idx
  ON public.stock_alerts (product_id, lower(email))
  WHERE notified_at IS NULL;

-- The restock query: everyone still waiting on this product.
CREATE INDEX IF NOT EXISTS stock_alerts_pending_idx
  ON public.stock_alerts (product_id)
  WHERE notified_at IS NULL;

COMMENT ON TABLE public.stock_alerts IS
  'People waiting for a sold-out product to return. Written by /api/stock-alerts, drained by the admin restock flow. Holds an email address, so anon has no grant of any kind.';

-- ---------------------------------------------------------------------------
-- 2. Lock it down
-- ---------------------------------------------------------------------------
-- This table is a list of email addresses paired with what each person wants
-- to buy. Everything touching it runs server-side under the service role.
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'stock_alerts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.stock_alerts', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.stock_alerts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Candidates: sold-out products included, and marked
-- ---------------------------------------------------------------------------
-- The return type gains is_sold_out, so the old definition goes first.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS signature
             FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname IN ('product_candidates', 'count_products', 'list_products')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.signature);
  END LOOP;
END $$;

CREATE FUNCTION public.product_candidates(
  p_category      TEXT    DEFAULT NULL,
  p_subcategory   TEXT    DEFAULT NULL,
  p_min_price     INTEGER DEFAULT NULL,
  p_max_price     INTEGER DEFAULT NULL,
  p_sizes         TEXT[]  DEFAULT NULL,
  p_colors        TEXT[]  DEFAULT NULL,
  -- Was p_in_stock, defaulting TRUE. Renamed as well as re-defaulted so a
  -- caller still passing the old argument fails loudly instead of quietly
  -- meaning the opposite of what it used to.
  p_in_stock_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  product_id uuid,
  eff_price integer,
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
         COALESCE(va.agg_min_price, p.price)::integer,
         COALESCE(ps.units_sold, 0)::bigint,
         p.name,
         p.created_at,
         (p.stock <= 0)
    FROM public.products p
    LEFT JOIN variant_agg          va ON va.product_id = p.id
    LEFT JOIN public.product_sales ps ON ps.product_id = p.id
   WHERE p.is_active = true
     AND (p_category    IS NULL OR p.category     = p_category)
     AND (p_subcategory IS NULL OR p.sub_category = p_subcategory)
     -- Now an opt-in. Sold out is a state to show, not a reason to hide.
     AND (NOT COALESCE(p_in_stock_only, FALSE) OR p.stock > 0)
     AND (p_min_price IS NULL OR COALESCE(va.agg_min_price, p.price) >= p_min_price)
     AND (p_max_price IS NULL OR COALESCE(va.agg_min_price, p.price) <= p_max_price)
     -- && is "overlaps": keep the product if it offers any requested size.
     AND (p_sizes  IS NULL OR COALESCE(va.agg_sizes,  p.sizes,  '{}'::text[]) && p_sizes)
     AND (p_colors IS NULL OR COALESCE(va.agg_colors, p.colors, '{}'::text[]) && p_colors);
$fn$;

COMMENT ON FUNCTION public.product_candidates IS
  'The single definition of which products match a set of storefront facets. Sold-out products are included and flagged; list_products() ranks them last.';

CREATE FUNCTION public.count_products(
  p_category      TEXT    DEFAULT NULL,
  p_subcategory   TEXT    DEFAULT NULL,
  p_min_price     INTEGER DEFAULT NULL,
  p_max_price     INTEGER DEFAULT NULL,
  p_sizes         TEXT[]  DEFAULT NULL,
  p_colors        TEXT[]  DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT FALSE
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
      p_sizes, p_colors, p_in_stock_only
    );
$fn$;

COMMENT ON FUNCTION public.count_products IS
  'How many products match a facet set. Separate from list_products() so a "load more" costs one keyset range scan and no counting.';

-- ---------------------------------------------------------------------------
-- 4. The page, with sold-out ranked last
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.list_products(
  p_category      TEXT    DEFAULT NULL,
  p_subcategory   TEXT    DEFAULT NULL,
  p_min_price     INTEGER DEFAULT NULL,
  p_max_price     INTEGER DEFAULT NULL,
  p_sizes         TEXT[]  DEFAULT NULL,
  p_colors        TEXT[]  DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT FALSE,
  p_sort          TEXT    DEFAULT 'newest',
  p_limit         INTEGER DEFAULT 24,
  p_cursor_id       UUID        DEFAULT NULL,
  -- Which block the previous page ended in. Without it, the first "load more"
  -- after crossing into the sold-out section would jump back to in-stock rows.
  p_cursor_sold_out BOOLEAN     DEFAULT NULL,
  p_cursor_price    INTEGER     DEFAULT NULL,
  p_cursor_sold     BIGINT      DEFAULT NULL,
  p_cursor_name     TEXT        DEFAULT NULL,
  p_cursor_created  TIMESTAMPTZ DEFAULT NULL
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
  -- A cursor from before this migration has no block; treat it as in-stock,
  -- which is where every pre-existing cursor pointed.
  v_cursor_out BOOLEAN := COALESCE(p_cursor_sold_out, FALSE);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.product_candidates(
      p_category, p_subcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock_only
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
      -- Two-level, because is_sold_out runs ASC while most sort keys run DESC
      -- and a row-value comparison needs one direction throughout. First: any
      -- row in a later block is past the cursor whatever its key.
      OR (c.is_sold_out AND NOT v_cursor_out)
      -- Then: same block, past the key.
      OR (c.is_sold_out = v_cursor_out AND (
              (v_sort = 'price_asc'    AND (c.eff_price,    c.product_id) > (p_cursor_price,   p_cursor_id))
           OR (v_sort = 'price_desc'   AND (c.eff_price,    c.product_id) < (p_cursor_price,   p_cursor_id))
           OR (v_sort = 'best_selling' AND (c.units_sold,   c.product_id) < (p_cursor_sold,    p_cursor_id))
           OR (v_sort = 'name'         AND (c.sort_name,    c.product_id) > (p_cursor_name,    p_cursor_id))
           OR (v_sort NOT IN ('price_asc', 'price_desc', 'best_selling', 'name')
                                       AND (c.sort_created, c.product_id) < (p_cursor_created, p_cursor_id))
         ))
   ORDER BY
     -- Sold-out last, under every sort. What you can buy comes first.
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
  'One keyset page of the storefront listing, sold-out products ranked last. The cursor is (is_sold_out, sort key, id) — pass the previous page''s last row back through p_cursor_sold_out and the typed key column its sort uses.';

-- ---------------------------------------------------------------------------
-- 5. Facet options, now that sold-out products are on the shelf
-- ---------------------------------------------------------------------------
-- 20251101002900 built the option lists from `p.stock > 0`, which was right
-- while sold-out products were hidden and is wrong now that they are listed.
-- Left alone, a size whose every product is sold out would vanish from the
-- filter — so the shopper could see the product in the grid but could not
-- filter to it, and the sidebar would quietly disagree with the listing.
--
-- CREATE OR REPLACE is enough here: the signature and return type are unchanged.
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
  'Size, colour and price bounds within a category scope, across every listed product including sold-out ones — so the sidebar can never offer fewer options than the grid shows.';
