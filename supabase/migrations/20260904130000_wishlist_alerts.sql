-- ============================================================================
-- Making a wishlist worth something to the customer and to the shop
-- ----------------------------------------------------------------------------
-- A saved product is the clearest demand signal a small store gets: somebody
-- wanted this and did not buy it. Until now nothing acted on it. Two things
-- stop it being acted on:
--
--   1. Nothing knows what the product was like when it was saved, so nothing
--      can tell that it has since become cheaper or come back into stock.
--   2. Nothing records that a customer has already been told, so a nightly
--      sweep would mail the same person the same news every night.
--
-- Four columns fix both.
--
-- WHY A PRICE IS STORED HERE AT ALL
--
-- The browser must not store prices — that is the bug this work exists to fix,
-- because a stored price is displayed and goes stale. This one is never
-- displayed. It is a *baseline*: the number today's price is compared against
-- to decide whether anything worth an email has happened. The card a customer
-- sees still comes from product_cards(), always current.
--
-- Safe to run more than once.
-- ============================================================================

-- The cheapest way to buy this product at the moment it was saved. NULL for
-- rows that pre-date this migration: the first sweep fills them in and starts
-- watching from there, rather than inventing a drop that never happened.
ALTER TABLE public.customer_wishlist
  ADD COLUMN IF NOT EXISTS reference_price integer;

-- Stock as last observed, so a 0 -> positive transition can be detected per
-- saved row. Per row rather than per product on purpose: somebody who saved a
-- sold-out item should hear when it returns, and somebody who saved it after
-- it returned should not hear anything at all.
ALTER TABLE public.customer_wishlist
  ADD COLUMN IF NOT EXISTS last_seen_stock integer;

ALTER TABLE public.customer_wishlist
  ADD COLUMN IF NOT EXISTS price_notified_at timestamptz;

ALTER TABLE public.customer_wishlist
  ADD COLUMN IF NOT EXISTS stock_notified_at timestamptz;

COMMENT ON COLUMN public.customer_wishlist.reference_price IS
  'Cheapest price for this product when it was saved, or when an alert last went out. A baseline for comparison only — never displayed, and never the price anybody is charged.';

COMMENT ON COLUMN public.customer_wishlist.last_seen_stock IS
  'Stock as last observed by the wishlist sweep. A 0 -> positive change is what makes a back-in-stock email.';

COMMENT ON COLUMN public.customer_wishlist.price_notified_at IS
  'When this customer was last told this product got cheaper.';

COMMENT ON COLUMN public.customer_wishlist.stock_notified_at IS
  'When this customer was last told this product was back.';

-- ---------------------------------------------------------------------------
-- The sweep's read
-- ---------------------------------------------------------------------------
-- The nightly job walks the whole table in product order, so it can ask the
-- catalogue about each product once rather than once per customer.
CREATE INDEX IF NOT EXISTS customer_wishlist_product_idx
  ON public.customer_wishlist (product_id);

-- ---------------------------------------------------------------------------
-- What the shop gets out of it
-- ---------------------------------------------------------------------------
-- "What do people want that they have not bought" — the panel on the admin
-- dashboard that informs restocking. A view rather than a query in the route
-- so the definition of "most wishlisted" lives with the data, and so the
-- service role reads one thing.
--
-- Only active products: a delisted one cannot be restocked, and listing it
-- would send an admin looking for something they took down themselves.
CREATE OR REPLACE VIEW public.most_wishlisted AS
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.main_image,
    p.stock,
    p.price,
    count(*)::int AS saved_by,
    max(w.created_at) AS last_saved_at
  FROM public.customer_wishlist w
  JOIN public.products p ON p.id = w.product_id
  WHERE p.is_active
  GROUP BY p.id, p.name, p.main_image, p.stock, p.price;

COMMENT ON VIEW public.most_wishlisted IS
  'Active products by how many customers have saved them. Feeds the admin dashboard panel that informs restocking.';

-- A view inherits no RLS of its own; this one reads a table the anon and
-- authenticated roles have no grant on, and only the service role queries it.
REVOKE ALL ON public.most_wishlisted FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'watched products' AS item,
       count(*)::text || ' saved rows across '
         || count(DISTINCT product_id)::text || ' products' AS detail
  FROM public.customer_wishlist;
