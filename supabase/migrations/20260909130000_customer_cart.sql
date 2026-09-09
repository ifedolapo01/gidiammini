-- ============================================================================
-- A cart that follows the customer, not the browser
-- ----------------------------------------------------------------------------
-- Same problem migration 20251101003700 solved for the wishlist: a cart built
-- on a phone at lunchtime does not exist on the laptop that finishes the order
-- that evening, and baby/kids purchases are routinely browsed on one device
-- and completed on another, often by two people.
--
-- localStorage stays the guest cart and the local cache for everybody — this
-- table only adds a server copy once somebody is signed in.
--
-- IDS + QUANTITY ONLY
--
-- Same trust boundary as lib/commerce/cart-input.ts: price, name and image are
-- never stored here, only ever resolved from the catalogue at read time, so a
-- synced cart can never quote a stale price.
--
-- Normalised, not JSONB: a cart line's identity is (customer_id, product_id,
-- size, color) — the exact triple cartLineKey() already uses — so a composite
-- primary key gives upsert-based dedup for free, the same way the wishlist's
-- (customer_id, product_id) key does.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_cart (
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  -- '' rather than NULL for size/color, so the pair can sit inside a primary
  -- key at all — NULL is never equal to NULL in a uniqueness check. This is
  -- the same empty-slot sentinel cartLineKey() already uses (`size ?? ''`),
  -- so the app-level key and the database key agree.
  size text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',

  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (customer_id, product_id, size, color)
);

-- The read: this customer's cart, most recently touched first.
CREATE INDEX IF NOT EXISTS customer_cart_recent_idx
  ON public.customer_cart (customer_id, updated_at DESC);

COMMENT ON TABLE public.customer_cart IS
  'Cart lines for a signed-in customer, ids and quantity only — price, name and image are always re-resolved from the catalogue at read time, same trust boundary as cart-input.ts. localStorage remains the guest cart and the local cache for everybody.';

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
-- What somebody intends to buy, tied to their identity. Read and written only
-- by the account routes, under the service role.
ALTER TABLE public.customer_cart ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'customer_cart'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.customer_cart', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.customer_cart FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'cart lines' AS item,
       count(*)::text || ' across ' || count(DISTINCT customer_id)::text || ' customers' AS detail
  FROM public.customer_cart;
