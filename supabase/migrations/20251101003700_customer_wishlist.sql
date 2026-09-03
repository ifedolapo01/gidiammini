-- ============================================================================
-- A wishlist that follows the customer, not the browser
-- ----------------------------------------------------------------------------
-- The wishlist has always lived in localStorage. That is the right default —
-- it works for a guest, needs no account and costs nothing — but it means the
-- list a mother built on her phone at night does not exist on the laptop she
-- buys from, and clearing site data throws it away silently.
--
-- Now that a customer can be signed in without a password (20251101003600),
-- the list can follow them. localStorage stays the source of truth for
-- everybody else, and stays the local cache for everybody: signing in adds a
-- server copy, it does not replace the mechanism.
--
-- IDS ONLY
--
-- The browser stores whole product snapshots so a guest's list survives with
-- no server. This table stores only which product, because it does not need
-- to: a signed-in list is looked up through product_cards(), the same
-- projection the listing and every rail use, so a wishlisted product shows its
-- current price and stock rather than what it cost when it was hearted.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_wishlist (
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- The natural key, and the reason no id column exists: a wishlist entry *is*
  -- the pair. It also makes "add" an upsert that cannot create duplicates when
  -- two devices heart the same product at once.
  PRIMARY KEY (customer_id, product_id)
);

-- The read: this customer's list, most recently added first.
CREATE INDEX IF NOT EXISTS customer_wishlist_recent_idx
  ON public.customer_wishlist (customer_id, created_at DESC);

COMMENT ON TABLE public.customer_wishlist IS
  'Saved products for a signed-in customer. Ids only — the card is looked up through product_cards() so a saved product shows its current price and stock. localStorage remains the guest wishlist and the local cache.';

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
-- Which products somebody is considering, tied to their identity. Read and
-- written only by the account routes, under the service role.
ALTER TABLE public.customer_wishlist ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'customer_wishlist'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.customer_wishlist', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.customer_wishlist FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'saved products' AS item,
       count(*)::text || ' across ' || count(DISTINCT customer_id)::text || ' customers' AS detail
  FROM public.customer_wishlist;
