-- ============================================================================
-- Size guidance: what "6-12 months" actually means
-- ----------------------------------------------------------------------------
-- The product page showed raw size strings and nothing else. On a store
-- selling clothes for growing children that is the single worst place to be
-- silent: sizing is inconsistent between brands, children change size every
-- few months, and "6-12 months" means different things to different parents.
-- Fit uncertainty is the largest cause of both abandonment and returns in
-- kidswear, and a return conversation costs this shop more time than anything
-- else it does.
--
-- The measurement tables themselves are reference data and live in the code
-- (lib/data/size-charts.ts) — they do not change per shop, and a table nobody
-- can edit is a table nobody can get wrong. What this migration adds is the
-- two things that *are* specific to this shop's stock:
--
--   * categories.size_guidance — a paragraph per category, written by whoever
--     handles the returns. "Our sleepsuits have fold-over mittens, so the arm
--     length runs long" is knowledge that exists in one person's head and
--     needs somewhere to live.
--   * products.fit_rating / fit_note — the per-product answer to the only
--     question a parent actually asks: does this run true, small or large.
--
-- SIZING_TYPE GAINS 'maternity'
--
-- The column already distinguished 'size' from 'age', which is what picks
-- between a letter-size chart and an age-to-measurement one. Maternity needs a
-- third: body measurements against a pre-pregnancy size, which is neither. The
-- storefront also falls back to the maternity chart for a product in the
-- maternity category whose sizing_type was never set, so existing rows get the
-- right chart without anybody editing them.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-category guidance
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS size_guidance TEXT;

DO $$
BEGIN
  ALTER TABLE public.categories
    ADD CONSTRAINT categories_size_guidance_length
    CHECK (size_guidance IS NULL OR char_length(size_guidance) <= 2000);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.categories.size_guidance IS
  'Free text shown at the top of the size guide for every product in this category. Written in the admin; the measurement tables themselves are in code.';

-- ---------------------------------------------------------------------------
-- 2. Per-product fit
-- ---------------------------------------------------------------------------
-- Two columns rather than one free-text field. The rating is the part a
-- shopper reads in half a second and the part the selector can show inline
-- without opening anything, so it has to be a value the code can branch on —
-- "runs small" buried in a paragraph is not.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fit_rating TEXT;

DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_fit_rating_values
    CHECK (fit_rating IS NULL OR fit_rating IN ('runs_small', 'true_to_size', 'runs_large'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fit_note TEXT;

DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_fit_note_length
    CHECK (fit_note IS NULL OR char_length(fit_note) <= 300);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.products.fit_rating IS
  'runs_small | true_to_size | runs_large. Rendered inline beside the size selector, not only inside the guide — it is the one thing a parent wants to know before choosing.';
COMMENT ON COLUMN public.products.fit_note IS
  'One sentence of specifics under the rating, e.g. "the neck opening is snug on bigger heads". Optional.';

-- ---------------------------------------------------------------------------
-- 3. sizing_type allows 'maternity'
-- ---------------------------------------------------------------------------
-- 20251101000200 created the column with CHECK (sizing_type IN ('size',
-- 'age')). The constraint has to be dropped and rebuilt; there is no ALTER for
-- a CHECK's expression. The name is the one Postgres generated for it.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sizing_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_sizing_type_check
  CHECK (sizing_type IS NULL OR sizing_type IN ('size', 'age', 'maternity'));

COMMENT ON COLUMN public.products.sizing_type IS
  'Which size guide this product is measured by: size (letter/number chart), age (age-to-measurement chart), maternity (body measurements). Also chooses the selector''s label.';

-- ---------------------------------------------------------------------------
-- 4. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'categories with guidance' AS item,
       count(*) FILTER (WHERE size_guidance IS NOT NULL)::text || ' of ' || count(*)::text AS detail
  FROM public.categories

UNION ALL
SELECT 'products with a fit rating',
       count(*) FILTER (WHERE fit_rating IS NOT NULL)::text || ' of ' || count(*)::text
  FROM public.products

UNION ALL
SELECT 'sizing_type: ' || COALESCE(sizing_type, 'not set'), count(*)::text
  FROM public.products
 GROUP BY sizing_type
 ORDER BY item;
