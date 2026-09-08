-- ============================================================================
-- Merchandising controls: which products the home page picks, and in what order
-- ----------------------------------------------------------------------------
-- The home page previously had exactly one lever: ORDER BY created_at DESC
-- LIMIT 4. Running a seasonal push, clearing slow stock, or pulling a sold-out
-- item off the front door all meant an engineer and a deploy.
--
-- is_featured is the toggle; featured_rank is the order. Rank is nullable
-- because "featured, no particular order yet" is a real and common state — a
-- product just flagged from the bulk bar does not need a position assigned
-- before it can show up.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer;

COMMENT ON COLUMN public.products.is_featured IS
  'Curated onto the home page''s featured grid. Set from the products list bulk bar.';
COMMENT ON COLUMN public.products.featured_rank IS
  'Display order within the featured grid, lowest first. Null sorts after every ranked row (COALESCE to a large value in the query, not here).';

-- The home page's whole query: featured, in stock, ordered by rank. Partial on
-- is_featured, since every unfeatured row (the overwhelming majority) has no
-- business in this index at all.
CREATE INDEX IF NOT EXISTS idx_products_featured
  ON public.products (featured_rank)
  WHERE is_featured = true;
