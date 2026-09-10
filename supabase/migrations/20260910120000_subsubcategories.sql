-- ============================================================================
-- A third catalogue level: sub-subcategories (e.g. Babies > Gear > Monitors)
-- ----------------------------------------------------------------------------
-- categories -> subcategories was a fixed two-level tree. Some subcategories
-- (e.g. "Gear") are wide enough to need their own breakdown (Monitors, Car
-- Seats, Carriers) without inventing a third top-level category for them.
--
-- Mirrors subcategories exactly: subsubcategories.subcategory_slug references
-- subcategories(slug) the same way subcategories.category_slug references
-- categories(slug) (ON DELETE CASCADE ON UPDATE CASCADE), same RLS shape, same
-- globally-unique slug convention (not composite with the parent slug).
--
-- products.sub_sub_category is added the same way sub_category was in
-- 20251101000100 — a bare TEXT column, no FK, matched to
-- subsubcategories.slug by application code. It is optional; a product may
-- have a category and sub_category with no sub_sub_category.
--
-- product_candidates()/count_products()/list_products() gain p_subsubcategory,
-- placed next to p_subcategory, filtering p.sub_sub_category with the same
-- NULL-means-no-filter semantics p_subcategory already uses. Their signatures
-- are changing (a new parameter is being inserted ahead of the last one,
-- p_search, rather than only appended at the very end), so — following the
-- same requirement 20251101003100 and 20260909120000 already established for
-- this exact trio — every existing overload is dropped by its full current
-- signature before being recreated. (In practice PostgREST/supabase-js always
-- calls these with named arguments, so callers are unaffected regardless of
-- parameter position; the DROP is done anyway to match the established
-- pattern and because CREATE OR REPLACE cannot reorder parameters.)
--
-- product_facet_options() only ever used p_category/p_subcategory to narrow
-- the pool of products its size/colour/price bounds are computed over — it
-- does not return per-category or per-subcategory facet counts of any kind.
-- p_subsubcategory is added the same way, as one more scope filter. Dropped
-- by its exact current signature first, same as the trio above: a function's
-- identity in Postgres is its name plus its argument *types*, and adding a
-- parameter changes that list even when the new one has a default — so
-- CREATE OR REPLACE does not replace the old two-argument function at all,
-- it silently creates a second, three-argument overload alongside it. (This
-- migration shipped with CREATE OR REPLACE here on its first attempt; it
-- failed at the COMMENT ON FUNCTION statement below with "function name is
-- not unique" once both overloads existed, which is exactly that ambiguity.)
--
-- search_products(), top_categories(), product_cards() and
-- related_product_ids() are deliberately left untouched:
--   - search_products() ranks full-text search over search_vector (which now
--     includes sub_sub_category via the trigger below) — it has no
--     p_subcategory/p_subsubcategory parameter today and needs none to keep
--     working.
--   - top_categories() only joins categories to products.category — it has
--     no concept of subcategory or sub-subcategory at all.
--   - product_cards() is a shape-lookup for an explicit p_ids array, not a
--     category filter.
--   - related_product_ids() hard-filters on category and soft-ranks on
--     sub_category equality; it keeps working unmodified (a sub-subcategory
--     tie-break ahead of that would be a relevance improvement, not a
--     correctness requirement, and is left as a follow-up).
--
-- Also folded in here: discounts.scope's CHECK constraint enumerates
-- SITEWIDE/CATEGORY/SUBCATEGORY/PRODUCT/VARIANT with no SUBSUBCATEGORY value
-- (20251101000400_discounts_variant_scope.sql). Without this, a discount
-- cannot be scoped precisely to a sub-subcategory. Fixed using the exact
-- drop-and-readd pattern that migration already used for VARIANT.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. subsubcategories table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subsubcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_slug TEXT NOT NULL REFERENCES public.subcategories(slug) ON DELETE CASCADE ON UPDATE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.subsubcategories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on subsubcategories') THEN
        CREATE POLICY "Allow public read access on subsubcategories" ON public.subsubcategories FOR SELECT USING (true);
    END IF;
END $$;

COMMENT ON TABLE public.subsubcategories IS
  'The third catalogue level under subcategories, e.g. Babies > Gear > Monitors. Same shape and RLS posture as subcategories: public read, no anon writes (no INSERT/UPDATE/DELETE policy exists, so RLS default-denies them).';

-- ---------------------------------------------------------------------------
-- 2. products.sub_sub_category
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_sub_category TEXT;

COMMENT ON COLUMN public.products.sub_sub_category IS
  'Matched to subsubcategories.slug by application code, the same way sub_category is matched to subcategories.slug. No FK, consistent with category/sub_category. NULL means the product has no third-level classification.';

-- ---------------------------------------------------------------------------
-- 3. Search vector: index sub_sub_category the same way sub_category is indexed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.products_build_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')
    || setweight(to_tsvector('english',
         coalesce(replace(NEW.category, '-', ' '), '') || ' ' ||
         coalesce(replace(NEW.sub_category, '-', ' '), '') || ' ' ||
         coalesce(replace(NEW.sub_sub_category, '-', ' '), '')), 'B')
    || setweight(to_tsvector('english', coalesce(array_to_string(NEW.details, ' '), '')), 'C')
    || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_search_vector_trg ON public.products;
CREATE TRIGGER products_search_vector_trg
  BEFORE INSERT OR UPDATE OF name, description, category, sub_category, sub_sub_category, details
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_build_search_vector();

COMMENT ON COLUMN public.products.search_vector IS
  'Weighted full-text index over name (A), category/sub_category/sub_sub_category (B), details (C), description (D). Maintained by products_search_vector_trg.';

-- ---------------------------------------------------------------------------
-- 4. product_candidates / count_products / list_products: add p_subsubcategory
-- ---------------------------------------------------------------------------
-- Existing signatures, exactly as created by 20260909120000 (verified: no
-- later migration touches these three functions) — dropped before recreation
-- because a parameter is being inserted ahead of the trailing p_search
-- parameter, not merely appended after it.
DROP FUNCTION IF EXISTS public.product_candidates(text, text, integer, integer, text[], text[], boolean, text);
DROP FUNCTION IF EXISTS public.count_products(text, text, integer, integer, text[], text[], boolean, text);
DROP FUNCTION IF EXISTS public.list_products(text, text, integer, integer, text[], text[], boolean, text, text, integer, uuid, boolean, integer, bigint, text, timestamptz);

CREATE FUNCTION public.product_candidates(
  p_category       TEXT    DEFAULT NULL,
  p_subcategory    TEXT    DEFAULT NULL,
  p_subsubcategory TEXT    DEFAULT NULL,
  p_min_price      INTEGER DEFAULT NULL,
  p_max_price      INTEGER DEFAULT NULL,
  p_sizes          TEXT[]  DEFAULT NULL,
  p_colors         TEXT[]  DEFAULT NULL,
  p_in_stock_only  BOOLEAN DEFAULT FALSE,
  -- NULL means "no search predicate", same convention as every other facet
  -- here. A blank or unsearchable query is normalised to NULL by the caller
  -- (see product-filters.ts) before it ever reaches this function.
  p_search         TEXT    DEFAULT NULL
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
         COALESCE(va.agg_min_price, p.price)::integer,
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
  'The single definition of which products match a set of storefront facets, now including an optional sub-subcategory and search predicate. Sold-out products are included and flagged; list_products() ranks them last.';

CREATE FUNCTION public.count_products(
  p_category       TEXT    DEFAULT NULL,
  p_subcategory    TEXT    DEFAULT NULL,
  p_subsubcategory TEXT    DEFAULT NULL,
  p_min_price      INTEGER DEFAULT NULL,
  p_max_price      INTEGER DEFAULT NULL,
  p_sizes          TEXT[]  DEFAULT NULL,
  p_colors         TEXT[]  DEFAULT NULL,
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
  p_category       TEXT    DEFAULT NULL,
  p_subcategory    TEXT    DEFAULT NULL,
  p_subsubcategory TEXT    DEFAULT NULL,
  p_min_price      INTEGER DEFAULT NULL,
  p_max_price      INTEGER DEFAULT NULL,
  p_sizes          TEXT[]  DEFAULT NULL,
  p_colors         TEXT[]  DEFAULT NULL,
  p_in_stock_only  BOOLEAN DEFAULT FALSE,
  p_search         TEXT    DEFAULT NULL,
  p_sort           TEXT    DEFAULT 'newest',
  p_limit          INTEGER DEFAULT 24,
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
  images text[],
  colors text[],
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
  -- A cursor from before this migration has no block; treat it as in-stock,
  -- which is where every pre-existing cursor pointed.
  v_cursor_out BOOLEAN := COALESCE(p_cursor_sold_out, FALSE);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.product_candidates(
      p_category, p_subcategory, p_subsubcategory, p_min_price, p_max_price,
      p_sizes, p_colors, p_in_stock_only, p_search
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
  'One keyset page of the storefront listing, sold-out products ranked last, now including an optional sub-subcategory and search predicate. The cursor is (is_sold_out, sort key, id) — pass the previous page''s last row back through p_cursor_sold_out and the typed key column its sort uses.';

-- ---------------------------------------------------------------------------
-- 5. product_facet_options: p_subsubcategory as one more scope filter
-- ---------------------------------------------------------------------------
-- Unlike the trio above, this function returns no category/subcategory
-- breakdown of any kind today — p_category/p_subcategory only narrow the pool
-- of products its sizes/colours/price bounds are computed over. p_subsubcategory
-- does the same. Its current signature (verified live: product_facet_options(text,
-- text)) is dropped first, same reasoning as the trio above — adding a
-- parameter changes the function's identity even with a default, so
-- CREATE OR REPLACE would create a second overload rather than replace this one.
DROP FUNCTION IF EXISTS public.product_facet_options(text, text);

CREATE FUNCTION public.product_facet_options(
  p_category       TEXT DEFAULT NULL,
  p_subcategory    TEXT DEFAULT NULL,
  p_subsubcategory TEXT DEFAULT NULL
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
       AND (p_category       IS NULL OR p.category         = p_category)
       AND (p_subcategory    IS NULL OR p.sub_category      = p_subcategory)
       AND (p_subsubcategory IS NULL OR p.sub_sub_category  = p_subsubcategory)
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
  'Size, colour and price bounds within a category/subcategory/sub-subcategory scope, across every listed product including sold-out ones — so the sidebar can never offer fewer options than the grid shows.';

-- ---------------------------------------------------------------------------
-- 6. discounts: allow scoping a discount to a sub-subcategory
-- ---------------------------------------------------------------------------
-- Same drop-and-readd pattern 20251101000400_discounts_variant_scope.sql used
-- to add VARIANT. target_id already holds "category slug, subcategory slug,
-- or product ID depending on scope" (per the original column comment) — a
-- SUBSUBCATEGORY row stores a subsubcategories.slug there the same way.
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_scope_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_scope_check
  CHECK (scope IN ('SITEWIDE', 'CATEGORY', 'SUBCATEGORY', 'SUBSUBCATEGORY', 'PRODUCT', 'VARIANT'));

-- ---------------------------------------------------------------------------
-- 7. Report the resulting state (mirrors 20251101001700's closing report,
--    extended with the new table; does not edit that migration)
-- ---------------------------------------------------------------------------
SELECT c.relname                                        AS table_name,
       CASE WHEN c.relrowsecurity THEN 'on' ELSE 'OFF' END AS rls,
       COALESCE((SELECT count(*)::text FROM pg_policies pp
                  WHERE pp.schemaname = 'public' AND pp.tablename = c.relname), '0') AS policies,
       COALESCE((SELECT string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type)
                   FROM information_schema.role_table_grants g
                  WHERE g.table_schema = 'public'
                    AND g.table_name = c.relname
                    AND g.grantee = 'anon'), '(none)') AS anon_grants
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN ('categories', 'subcategories', 'subsubcategories')
 ORDER BY c.relname;
