-- ============================================================================
-- Search: synonyms, a shared search predicate on the listing, and a
-- did-you-mean fallback for zero results
-- ----------------------------------------------------------------------------
-- /products has a full facet rail — category, price, size, colour,
-- availability. /search had none: a results page with forty matches offered no
-- way to narrow them, and typing "babygro", "onesie" or "sleep suit" for the
-- same garment matched none of them to each other, because Postgres FTS only
-- ever compares what was typed against what a product is actually named.
--
-- THREE PIECES
--
--   1. search_synonyms — an admin-entered term -> expansion table, consulted by
--      a new build_search_tsquery() so a shopper's word for a garment reaches
--      the catalogue's word for it. Both search_products() (the header
--      typeahead and the old results endpoint) and list_products() (the facet
--      rail, via the new p_search predicate below) go through the same
--      builder, so a synonym fixes both surfaces at once rather than one.
--
--   2. list_products()/count_products() gain p_search, added to
--      product_candidates() — the single definition of what matches a facet
--      set — so /search can page through loadListingPage exactly like
--      /products does and inherit its facets, sort and "Load more" for free,
--      instead of running a second, parallel listing implementation.
--
--      list_products() also starts returning images and colors. It stopped
--      returning them in 20251101003000 because the card drew neither — that
--      reasoning no longer holds once the card grows swatches and a hover
--      image, and both are short arrays, nothing like the pricing_config
--      JSONB blob that migration was slimming away.
--
--   3. pg_trgm + suggest_products() + top_categories() — the two things
--      offered on a genuine zero-result page instead of "try a shorter word":
--      the nearest product names by trigram similarity, and the busiest
--      categories to browse instead.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigram similarity, for "did you mean"
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON public.products USING GIN (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. Synonyms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** What a shopper might type, e.g. 'babygro'. Lower-cased at lookup time, not
   *  at write time, so the admin list can still show it as typed. */
  term text NOT NULL,
  /** What the catalogue actually calls it, e.g. 'onesie'. May be more than one
   *  word — build_search_tsquery() requires its words adjacent as a phrase
   *  rather than matching either one anywhere in the document. */
  expansion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_synonyms_not_blank CHECK (btrim(term) <> '' AND btrim(expansion) <> ''),
  -- The same term may expand to more than one word ('babygro' -> 'onesie' and
  -- 'babygro' -> 'sleepsuit' can both exist), but not the same pair twice.
  CONSTRAINT search_synonyms_unique UNIQUE (term, expansion)
);

CREATE INDEX IF NOT EXISTS search_synonyms_term_idx ON public.search_synonyms (lower(term));

COMMENT ON TABLE public.search_synonyms IS
  'Admin-entered term -> expansion pairs, e.g. babygro -> onesie. Consulted by build_search_tsquery(), which both search_products() and list_products() call.';

-- ---------------------------------------------------------------------------
-- 3. The shared query builder
-- ---------------------------------------------------------------------------
-- Extracted from what used to be search_products()'s own body, so list_products()
-- can gain a search predicate without a second, drifting copy of the same
-- word-splitting and synonym-lookup logic. Same safety property as before: no
-- input reaches to_tsquery except lower-cased, alnum-filtered tokens joined by
-- fixed operators, so nothing a shopper or an admin types can reach it as an
-- operator.
CREATE OR REPLACE FUNCTION public.build_search_tsquery(p_query TEXT)
RETURNS tsquery
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_words  TEXT[];
  v_last   INTEGER;
  v_alts   TEXT[];
  v_alt    TEXT;
  v_groups TEXT[] := '{}';
  v_query  TEXT;
  v_syn    RECORD;
BEGIN
  -- Split on anything that is not a letter or digit, discard the empties.
  SELECT array_agg(word) INTO v_words
    FROM (
      SELECT lower(word) AS word
        FROM regexp_split_to_table(COALESCE(p_query, ''), '[^[:alnum:]]+') AS word
       WHERE length(word) > 0
       LIMIT 8
    ) AS words;

  IF v_words IS NULL OR array_length(v_words, 1) = 0 THEN
    RETURN NULL;
  END IF;

  v_last := array_length(v_words, 1);

  FOR i IN 1..v_last LOOP
    v_alts := ARRAY[v_words[i]];

    -- "babygro" also searches "onesie", "sleepsuit", whatever an admin has
    -- taught it. Each expansion is reduced to its own alnum tokens and joined
    -- with <-> so a two-word expansion like "sleep suit" is required as a
    -- phrase, not matched as either word anywhere in the document.
    FOR v_syn IN
      SELECT s.expansion FROM public.search_synonyms s WHERE lower(s.term) = v_words[i]
    LOOP
      SELECT string_agg(lower(tok), '<->') INTO v_alt
        FROM regexp_split_to_table(v_syn.expansion, '[^[:alnum:]]+') AS tok
       WHERE length(tok) > 0;
      IF v_alt IS NOT NULL AND v_alt <> '' THEN
        v_alts := array_append(v_alts, v_alt);
      END IF;
    END LOOP;

    -- The last word may still be mid-typed: prefix-match every alternative,
    -- not just the literal one, so typeahead keeps working through a synonym.
    IF i = v_last THEN
      v_alts := ARRAY(SELECT x || ':*' FROM unnest(v_alts) AS x);
    END IF;

    v_groups := array_append(v_groups, '(' || array_to_string(v_alts, ' | ') || ')');
  END LOOP;

  v_query := array_to_string(v_groups, ' & ');

  RETURN to_tsquery('english', v_query);
END;
$fn$;

COMMENT ON FUNCTION public.build_search_tsquery IS
  'Turns visitor input into a tsquery, expanding each word through search_synonyms. The one place that builds a tsquery from arbitrary text — search_products() and product_candidates() both call it rather than each building their own.';

-- ---------------------------------------------------------------------------
-- 4. search_products() — now synonym-aware, same signature and shape
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_products(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  price integer,
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
  'The header typeahead''s search. Query building now lives in build_search_tsquery(), which also expands synonyms.';

-- ---------------------------------------------------------------------------
-- 5. p_search on the listing itself
-- ---------------------------------------------------------------------------
-- Built on the shape 20251101003100 left these three in — p_in_stock_only
-- (opt-in, default FALSE), is_sold_out carried through product_candidates, and
-- a two-level (is_sold_out, sort key) keyset cursor. All of that is preserved
-- untouched below; only p_search and, on list_products(), images/colors are
-- new. Every existing overload goes first, by name — the same requirement
-- 20251101003100 hit when is_sold_out was added, for the same reason: CREATE
-- OR REPLACE cannot alter a function's parameter list or return type in place.
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
  p_in_stock_only BOOLEAN DEFAULT FALSE,
  -- NULL means "no search predicate", same convention as every other facet
  -- here. A blank or unsearchable query is normalised to NULL by the caller
  -- (see product-filters.ts) before it ever reaches this function.
  p_search        TEXT    DEFAULT NULL
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
     AND (p_category    IS NULL OR p.category     = p_category)
     AND (p_subcategory IS NULL OR p.sub_category = p_subcategory)
     AND (NOT COALESCE(p_in_stock_only, FALSE) OR p.stock > 0)
     AND (p_min_price IS NULL OR COALESCE(va.agg_min_price, p.price) >= p_min_price)
     AND (p_max_price IS NULL OR COALESCE(va.agg_min_price, p.price) <= p_max_price)
     AND (p_sizes  IS NULL OR COALESCE(va.agg_sizes,  p.sizes,  '{}'::text[]) && p_sizes)
     AND (p_colors IS NULL OR COALESCE(va.agg_colors, p.colors, '{}'::text[]) && p_colors)
     AND (s.tsq IS NULL OR p.search_vector @@ s.tsq);
$fn$;

COMMENT ON FUNCTION public.product_candidates IS
  'The single definition of which products match a set of storefront facets, now including an optional search predicate. Sold-out products are included and flagged; list_products() ranks them last.';

CREATE FUNCTION public.count_products(
  p_category      TEXT    DEFAULT NULL,
  p_subcategory   TEXT    DEFAULT NULL,
  p_min_price     INTEGER DEFAULT NULL,
  p_max_price     INTEGER DEFAULT NULL,
  p_sizes         TEXT[]  DEFAULT NULL,
  p_colors        TEXT[]  DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT FALSE,
  p_search        TEXT    DEFAULT NULL
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
      p_sizes, p_colors, p_in_stock_only, p_search
    );
$fn$;

COMMENT ON FUNCTION public.count_products IS
  'How many products match a facet set, including an in-progress search. Separate from list_products() so "load more" costs one keyset range scan and no counting.';

CREATE FUNCTION public.list_products(
  p_category      TEXT    DEFAULT NULL,
  p_subcategory   TEXT    DEFAULT NULL,
  p_min_price     INTEGER DEFAULT NULL,
  p_max_price     INTEGER DEFAULT NULL,
  p_sizes         TEXT[]  DEFAULT NULL,
  p_colors        TEXT[]  DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT FALSE,
  p_search        TEXT    DEFAULT NULL,
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
  -- Back after 20251101003000 removed them: that migration's reasoning was
  -- "the card renders none of them", which stops being true once ProductCard
  -- draws colour swatches and a hover image. Both are short arrays, nothing
  -- like the pricing_config JSONB blob that migration was actually slimming
  -- away.
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
      p_category, p_subcategory, p_min_price, p_max_price,
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
  'One keyset page of the storefront listing, sold-out products ranked last, now including an optional search predicate. The cursor is (is_sold_out, sort key, id) — pass the previous page''s last row back through p_cursor_sold_out and the typed key column its sort uses.';

-- ---------------------------------------------------------------------------
-- 6. Zero-result fallback: nearest product names, and where else to look
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_products(p_query TEXT, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (id uuid, name text, main_image text, similarity real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p.id, p.name, p.main_image, similarity(p.name, COALESCE(p_query, ''))
    FROM public.products p
   WHERE p.is_active = true
     -- Below this, a suggestion reads as random rather than a correction —
     -- 0.15 is pg_trgm's own rule-of-thumb floor for "plausibly related".
     AND similarity(p.name, COALESCE(p_query, '')) > 0.15
   ORDER BY similarity(p.name, COALESCE(p_query, '')) DESC, p.name ASC
   LIMIT GREATEST(COALESCE(p_limit, 5), 1);
$fn$;

COMMENT ON FUNCTION public.suggest_products IS
  'Nearest product names by trigram similarity, for a zero-result search page''s "did you mean". Needs products_name_trgm_idx.';

CREATE OR REPLACE FUNCTION public.top_categories(p_limit INTEGER DEFAULT 3)
RETURNS TABLE (name text, slug text, product_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(c.display_name, c.name), c.slug, count(p.id)::bigint AS product_count
    FROM public.categories c
    JOIN public.products p ON p.category = c.slug
   WHERE p.is_active = true
     AND p.stock > 0
   GROUP BY c.slug, c.name, c.display_name
   ORDER BY product_count DESC, c.name ASC
   LIMIT GREATEST(COALESCE(p_limit, 3), 1);
$fn$;

COMMENT ON FUNCTION public.top_categories IS
  'The busiest categories by active, in-stock product count — the "or browse" offered beside search suggestions on a zero-result page.';

-- ---------------------------------------------------------------------------
-- 7. The zero-result list itself, for the admin panel
-- ---------------------------------------------------------------------------
-- What people searched for and found nothing, grouped and counted. Admins work
-- from this list to decide which term deserves a synonym next.
CREATE OR REPLACE VIEW public.zero_result_searches AS
  SELECT q.query,
         count(*)::bigint AS times_searched,
         max(q.created_at) AS last_searched_at,
         -- True once an admin has already added a fix for this exact term, so
         -- the panel can default to hiding what is already addressed.
         EXISTS (
           SELECT 1 FROM public.search_synonyms s WHERE lower(s.term) = q.query
         ) AS has_synonym
    FROM public.search_queries q
   WHERE q.result_count = 0
   GROUP BY q.query;

COMMENT ON VIEW public.zero_result_searches IS
  'Zero-result queries, grouped and counted, with has_synonym marking the ones an admin has already addressed. Feeds /admin/search.';

REVOKE ALL ON public.zero_result_searches FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Lock down
-- ---------------------------------------------------------------------------
-- Same shape as search_queries (20251101002800): read and written only through
-- /api/search and /api/admin/search, both server-side, both through the
-- service-role client. Nothing here is ever queried from the browser.
ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'search_synonyms'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.search_synonyms', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.search_synonyms FROM anon, authenticated;
