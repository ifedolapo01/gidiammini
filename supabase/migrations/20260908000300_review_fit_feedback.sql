-- ============================================================================
-- Fit feedback on reviews — closing the loop the size chart can't
-- ----------------------------------------------------------------------------
-- The store already has more sizing machinery than most: charts, an
-- age/height recommender, per-variant sizing, growth prompts, and an admin's
-- own "runs small / true to size / runs large" claim on the product. None of
-- it learns from the outcome. A shopper guesses a size, guesses wrong, and the
-- only trace of that is a change request or a return — never fed back to the
-- one place (the product page) where the next shopper is making the same
-- guess.
--
-- fit_rating on product_reviews is the same three-value vocabulary as
-- products.fit_rating (the admin's claim, migration 20260905-era), asked at
-- the moment someone who actually wore it is already telling us how it went.
-- Nullable and optional, like everything else on this form: a rating with no
-- fit answer is still a complete review.
--
-- The aggregate joins product_review_stats rather than getting a table of its
-- own, for the same reason the star counts live there: a view recomputed from
-- published rows cannot disagree with the rows it is derived from.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS fit_rating text
    CHECK (fit_rating IS NULL OR fit_rating IN ('runs_small', 'true_to_size', 'runs_large'));

COMMENT ON COLUMN public.product_reviews.fit_rating IS
  'How this size actually ran for the reviewer, self-reported at review time. Same vocabulary as products.fit_rating (the admin''s own claim) so the two can be compared rather than conflated. Aggregated into product_review_stats.';

CREATE OR REPLACE VIEW public.product_review_stats AS
  SELECT r.product_id,
         count(*)::integer                                       AS review_count,
         round(avg(r.rating)::numeric, 2)                        AS rating_average,
         count(*) FILTER (WHERE r.rating = 5)::integer           AS five_star,
         count(*) FILTER (WHERE r.rating = 4)::integer           AS four_star,
         count(*) FILTER (WHERE r.rating = 3)::integer           AS three_star,
         count(*) FILTER (WHERE r.rating = 2)::integer           AS two_star,
         count(*) FILTER (WHERE r.rating = 1)::integer           AS one_star,
         count(*) FILTER (WHERE r.is_verified_purchase)::integer AS verified_count,
         count(*) FILTER (WHERE r.fit_rating = 'runs_small')::integer    AS runs_small_count,
         count(*) FILTER (WHERE r.fit_rating = 'true_to_size')::integer  AS true_to_size_count,
         count(*) FILTER (WHERE r.fit_rating = 'runs_large')::integer    AS runs_large_count
    FROM public.product_reviews r
   WHERE r.status = 'published'
   GROUP BY r.product_id;

COMMENT ON VIEW public.product_review_stats IS
  'Published-review aggregate per product: count, average, star distribution, and self-reported fit counts. Read server-side for ProductCard stars, the product page''s aggregateRating and fit signal, and the admin''s per-product fit readout.';

-- CREATE OR REPLACE VIEW does not reset grants, but the original migration's
-- REVOKE stands regardless — restated so this file is a complete, idempotent
-- description of the view's access, not a diff against another file.
REVOKE ALL ON public.product_review_stats FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'column' AS item, 'product_reviews.fit_rating' AS name,
       count(*) FILTER (WHERE fit_rating IS NOT NULL)::text AS detail
  FROM public.product_reviews;
