-- ============================================================================
-- Product search: a tsvector, a GIN index, and a log of what people looked for
-- ----------------------------------------------------------------------------
-- There is no search anywhere in the storefront — no input, no route, no ilike
-- or full-text query. Category and subcategory buttons are the only way to find
-- anything, so a visitor who arrives knowing what they want ("newborn
-- sleepsuit", "nursing bra") has no path to it.
--
-- WHY A TRIGGER, NOT A GENERATED COLUMN
--
-- The obvious shape is `search_vector tsvector GENERATED ALWAYS AS (...)
-- STORED`, and it does not work here. A generated column requires an IMMUTABLE
-- expression, and `array_to_string(details, ' ')` is only STABLE — it calls the
-- element type's output function. That is the same trap that made
-- 20251101002600 fail its first push with "generation expression is not
-- immutable" (42P17). A BEFORE trigger has no such restriction and is the
-- long-standing Postgres pattern for exactly this.
--
-- WEIGHTING
--
-- A is the product name, B its category and subcategory, C its detail bullets,
-- D its description. So a search for "gown" ranks a product called "Baby Gown"
-- above one that merely mentions gowns in its description.
--
-- SEARCH QUERY LOG
--
-- Every search is recorded with how many results it returned. The zero-result
-- ones are the valuable half: they are a list, in customers' own words, of
-- things people came looking for and the store does not sell or does not name
-- the way they do. Nothing identifying is stored — no IP, no session — because
-- the demand signal does not need it and keeping it would make this table
-- personal data.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The vector
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.products_build_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')
    || setweight(to_tsvector('english',
         coalesce(replace(NEW.category, '-', ' '), '') || ' ' ||
         coalesce(replace(NEW.sub_category, '-', ' '), '')), 'B')
    || setweight(to_tsvector('english', coalesce(array_to_string(NEW.details, ' '), '')), 'C')
    || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_search_vector_trg ON public.products;
CREATE TRIGGER products_search_vector_trg
  BEFORE INSERT OR UPDATE OF name, description, category, sub_category, details
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_build_search_vector();

-- Backfill. The no-op UPDATE fires the trigger for every existing row.
UPDATE public.products SET name = name WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS products_search_vector_idx
  ON public.products USING GIN (search_vector);

COMMENT ON COLUMN public.products.search_vector IS
  'Weighted full-text index over name (A), category (B), details (C), description (D). Maintained by products_search_vector_trg.';

-- ---------------------------------------------------------------------------
-- 2. Searching
-- ---------------------------------------------------------------------------
-- The query is built inside this function rather than by the application, so
-- there is exactly one place that turns arbitrary visitor input into a
-- tsquery. Terms are reduced to word characters and joined with &, and the last
-- one gets a :* so typeahead matches a word still being typed — "sleep" finds
-- "sleepsuit". Because the string is rebuilt from scratch rather than
-- interpolated, no input can reach to_tsquery as operators.
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
  v_words TEXT[];
  v_query TEXT;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
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
    RETURN;
  END IF;

  -- Every word required; the last one prefix-matched for typeahead.
  v_query := array_to_string(v_words[1:array_length(v_words, 1) - 1], ' & ');
  IF v_query <> '' THEN
    v_query := v_query || ' & ';
  END IF;
  v_query := v_query || v_words[array_length(v_words, 1)] || ':*';

  RETURN QUERY
    SELECT p.id, p.name, p.price, p.category, p.sub_category, p.main_image, p.stock,
           ts_rank(p.search_vector, to_tsquery('english', v_query)) AS rank
      FROM public.products p
     WHERE p.is_active = true
       AND p.search_vector @@ to_tsquery('english', v_query)
     ORDER BY rank DESC, p.name ASC
     LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. What people searched for
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Lower-cased and trimmed, so "Nursing Bra" and "nursing bra " group. */
  query text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_queries_not_blank CHECK (btrim(query) <> '')
);

-- The report that matters: what people searched for and found nothing.
CREATE INDEX IF NOT EXISTS search_queries_zero_result_idx
  ON public.search_queries (query, created_at DESC)
  WHERE result_count = 0;

CREATE INDEX IF NOT EXISTS search_queries_created_at_idx
  ON public.search_queries (created_at DESC);

COMMENT ON TABLE public.search_queries IS
  'What visitors searched for and how many results they got. Zero-result rows are demand the catalogue does not meet. Deliberately holds nothing identifying.';

-- ---------------------------------------------------------------------------
-- 4. Lock down
-- ---------------------------------------------------------------------------
-- Visitors search through /api/search, which runs server-side; nothing reads or
-- writes these tables from the browser. products.search_vector is a new column
-- on an already-readable table and needs no extra grant — anon selects named
-- columns, and the vector is not one of them.
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'search_queries'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.search_queries', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.search_queries FROM anon, authenticated;
