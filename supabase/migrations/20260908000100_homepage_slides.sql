-- ============================================================================
-- The hero carousel, out of the bundle and into the database
-- ----------------------------------------------------------------------------
-- The three hero slides were `import`ed PNGs with copy hardcoded in
-- HeroCarousel.tsx: changing a headline or swapping a seasonal banner meant an
-- engineer and a deploy, on the single highest-traffic element of the site.
--
-- One row per slide, ordered by sort_order. The active window (starts_at /
-- ends_at) lets an admin schedule a campaign ahead of time and let it expire on
-- its own, rather than remembering to come back and turn it off.
--
-- Read by the storefront through the anon key (same as products and
-- categories), written only by the admin editor under the service role.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.homepage_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  image_path text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Shop Now',
  cta_link text NOT NULL DEFAULT '/products',

  /** Lower position shows first. Ties break on created_at so a freshly added
   *  slide has a stable, deterministic place until an admin reorders it. */
  sort_order integer NOT NULL DEFAULT 0,

  /** The admin's own on/off switch — independent of the scheduling window, so
   *  a slide can be prepared and left off until it is ready. */
  is_active boolean NOT NULL DEFAULT true,

  /** The scheduling window. Both nullable: null start means "already open",
   *  null end means "no expiry". */
  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT homepage_slides_window_order CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

CREATE INDEX IF NOT EXISTS idx_homepage_slides_active_order
  ON public.homepage_slides (sort_order, created_at)
  WHERE is_active = true;

COMMENT ON TABLE public.homepage_slides IS
  'The home page hero carousel, admin-curated. Read by the storefront anon key (active, in-window rows only); written by /api/admin/homepage-slides under the service role.';

CREATE OR REPLACE FUNCTION public.touch_homepage_slides_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS homepage_slides_touch_updated_at ON public.homepage_slides;
CREATE TRIGGER homepage_slides_touch_updated_at
  BEFORE UPDATE ON public.homepage_slides
  FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_slides_updated_at();

-- ---------------------------------------------------------------------------
-- Lock it down: anon reads active rows only, writes stay behind the service role
-- ---------------------------------------------------------------------------
ALTER TABLE public.homepage_slides ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'homepage_slides'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.homepage_slides', r.policyname);
  END LOOP;
END $$;

-- The time window is still filtered in the query (RLS cannot see "now" cheaply
-- per-row without a function call on every row) — this policy is the same
-- belt-and-braces as products: anon can never see a switched-off slide even if
-- a future query forgets the is_active filter.
CREATE POLICY "Anon can read active homepage slides"
  ON public.homepage_slides
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

REVOKE ALL    ON public.homepage_slides FROM anon, authenticated;
GRANT  SELECT ON public.homepage_slides TO   anon, authenticated;
