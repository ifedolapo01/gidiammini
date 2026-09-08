-- ============================================================================
-- Storefront behavioural events: the denominator every conversion number needs
-- ----------------------------------------------------------------------------
-- Every admin analytics panel is computed from orders, which answers "what
-- sold" and cannot answer "what nearly sold". This table is the missing half:
-- one row per view_item / add_to_cart / begin_checkout / purchase, so a
-- product's view count and its sale count can finally sit next to each other.
--
-- session_id is a hash (HMAC-SHA256, see lib/api/session-hash.ts), never the
-- raw client-generated id — the point is grouping rows from the same visit,
-- not identifying a person. Written only by the service role via
-- POST /api/events; nothing here is reachable by the anon key at all, the same
-- posture as stock_alerts and abandoned_carts.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.storefront_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /** HMAC-SHA256 of the client's anon id. Groups rows from one browser session
   *  without storing anything that identifies the visitor. */
  session_id text NOT NULL,

  event text NOT NULL,

  /** Null for a cart-level milestone (begin_checkout fires once per checkout,
   *  not once per line). Set for every product-scoped event. */
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,

  /** "size|color", when the shopper had a variant selected. */
  variant_key text,

  /** Line revenue for add_to_cart/purchase (price × quantity); null for
   *  view_item and begin_checkout, which carry no price of their own. */
  value numeric,

  ts timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT storefront_events_event_check
    CHECK (event IN ('view_item', 'add_to_cart', 'begin_checkout', 'purchase'))
);

-- The funnel query: counts per event over a date range.
CREATE INDEX IF NOT EXISTS idx_storefront_events_event_ts
  ON public.storefront_events (event, ts);

-- "Traffic without sales": per-product view/add-to-cart counts. Partial,
-- because begin_checkout rows (product_id IS NULL) have no business in it.
CREATE INDEX IF NOT EXISTS idx_storefront_events_product_event
  ON public.storefront_events (product_id, event, ts)
  WHERE product_id IS NOT NULL;

COMMENT ON TABLE public.storefront_events IS
  'One row per storefront funnel event (view_item, add_to_cart, begin_checkout, purchase). Written by POST /api/events under the service role; anon has no grant of any kind.';

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
ALTER TABLE public.storefront_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'storefront_events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.storefront_events', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.storefront_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- The dashboard's two reads
-- ---------------------------------------------------------------------------

-- How many distinct sessions reached each stage, in order, over the window.
-- Distinct sessions rather than raw row counts: a shopper who reopens a
-- product tab three times is one visitor who viewed it, not three.
CREATE OR REPLACE FUNCTION public.storefront_funnel(p_window_days integer DEFAULT 30)
RETURNS TABLE (event text, sessions bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT e.event, count(DISTINCT e.session_id)::bigint
    FROM public.storefront_events e
   WHERE e.ts >= now() - make_interval(days => GREATEST(p_window_days, 1))
   GROUP BY e.event;
$fn$;

COMMENT ON FUNCTION public.storefront_funnel IS
  'Distinct sessions reaching each funnel stage in the trailing window. The dashboard orders them view_item -> add_to_cart -> begin_checkout -> purchase and derives the drop-off between each.';

-- Products with real traffic and no sale: viewed or added to cart in the
-- window, never purchased in it. This is the list a markdown or a featured
-- slot is supposed to fix.
CREATE OR REPLACE FUNCTION public.storefront_traffic_without_sales(
  p_window_days integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  main_image text,
  price integer,
  stock integer,
  views bigint,
  add_to_carts bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH window_events AS (
    SELECT e.product_id, e.event
      FROM public.storefront_events e
     WHERE e.product_id IS NOT NULL
       AND e.ts >= now() - make_interval(days => GREATEST(p_window_days, 1))
  ),
  agg AS (
    SELECT product_id,
           count(*) FILTER (WHERE event = 'view_item')    AS views,
           count(*) FILTER (WHERE event = 'add_to_cart')  AS add_to_carts,
           count(*) FILTER (WHERE event = 'purchase')     AS purchases
      FROM window_events
     GROUP BY product_id
  )
  SELECT p.id, p.name, p.main_image, p.price, p.stock,
         a.views::bigint, a.add_to_carts::bigint
    FROM agg a
    JOIN public.products p ON p.id = a.product_id
   WHERE a.purchases = 0
     AND (a.views > 0 OR a.add_to_carts > 0)
   ORDER BY a.views DESC, a.add_to_carts DESC
   LIMIT GREATEST(p_limit, 1);
$fn$;

COMMENT ON FUNCTION public.storefront_traffic_without_sales IS
  'Products with genuine traffic (a view or an add-to-cart) and zero purchases in the window — the markdown/featured-slot candidate list that orders alone cannot produce.';
