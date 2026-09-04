-- ============================================================================
-- Abandoned carts: the one email nobody here could send
-- ----------------------------------------------------------------------------
-- The cart lives in localStorage and nowhere else, so a shopper who filled in
-- their details and then went to find their banking app left no trace at all.
-- On a transfer-first checkout that is the worst possible gap: those people
-- genuinely intended to pay, and the distance between the checkout page and a
-- bank app is where the intention dies.
--
-- ONE ROW PER EMAIL, NOT ONE PER VISIT
--
-- The row is not a log of abandonment events; it is "the cart we last saw for
-- this address". A shopper who edits their basket four times before wandering
-- off should produce one reminder, not four, and the table should grow with
-- distinct customers rather than with visits.
--
-- SENDING RULES ARE IN THE SCHEMA WHERE THEY CAN BE
--
-- This is unsolicited mail to somebody who typed an address into a form, so
-- the restraint matters more than the feature:
--
--   * At most two, ever, per abandonment — first_sent_at and second_sent_at
--     are stamps, not counters, so there is no third to send.
--   * Never after they buy. recovered_at is set the moment an order is placed
--     with that address, and every query excludes it.
--   * Never again if they ask. opted_out is permanent and survives the row
--     being reused for a later cart.
--   * A fresh sequence only after a real gap — see shouldRestartSequence in
--     lib/commerce/abandoned-cart.ts. Without that rule, somebody who browses
--     weekly would be reminded weekly forever.
--
-- ITEMS ARE IDS, NOT PRICES
--
-- The snapshot records what was in the basket, never what it cost. The email
-- is built from the catalogue as it is when the mail goes out, so it can never
-- quote a price the shop no longer charges — the same reason reorder
-- re-prices.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /** Lower-cased and trimmed by the application, like customers.email. */
  email text NOT NULL,

  /** Set when the address matches a known buyer. Null for a first-timer, who
   *  has no customers row until they order. */
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,

  /** Whatever they had typed. Used to address the email; a half-typed name is
   *  better than "Hello there" and no worse than nothing. */
  full_name text,
  phone text,

  /**
   * [{ product_id, size, color, quantity }]. Ids and quantities only — see the
   * header. Capped in the API rather than here, because a CHECK on a jsonb
   * array's length is a constraint nobody would think to look for.
   */
  items jsonb NOT NULL DEFAULT '[]'::jsonb,

  /** SHA-256 of the token in the resume link. Restores a cart; it is not a
   *  sign-in, and grants nothing but the basket it belongs to. */
  token_hash text NOT NULL UNIQUE,

  /** When the cart was last seen. The clock both reminders are measured from,
   *  so editing the basket restarts the wait rather than firing mid-shop. */
  abandoned_at timestamptz NOT NULL DEFAULT now(),

  first_sent_at timestamptz,
  second_sent_at timestamptz,

  /** They came back and ordered. Never mailed again for this cart. */
  recovered_at timestamptz,

  /** They asked not to be. Permanent, and deliberately not cleared when the
   *  row is reused for a later cart. */
  opted_out boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT abandoned_carts_email_normalised CHECK (email = lower(btrim(email))),
  CONSTRAINT abandoned_carts_email_not_blank CHECK (btrim(email) <> '')
);

-- The identity of a row: one per address.
CREATE UNIQUE INDEX IF NOT EXISTS abandoned_carts_email_key
  ON public.abandoned_carts (email);

-- The cron's query: what is due, oldest first. Partial, because a recovered or
-- opted-out row is never due again and there is no point indexing it.
CREATE INDEX IF NOT EXISTS abandoned_carts_due_idx
  ON public.abandoned_carts (abandoned_at)
  WHERE recovered_at IS NULL AND opted_out = false;

COMMENT ON TABLE public.abandoned_carts IS
  'The cart last seen for an email address that did not order, plus which reminders have gone out. One row per address, never more than two emails, and never after they buy or ask to stop.';

CREATE OR REPLACE FUNCTION public.touch_abandoned_carts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS abandoned_carts_touch_updated_at ON public.abandoned_carts;
CREATE TRIGGER abandoned_carts_touch_updated_at
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.touch_abandoned_carts_updated_at();

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
-- An email address paired with what somebody nearly bought. Written by the
-- checkout capture endpoint and read by the cron, both under the service role.
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'abandoned_carts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.abandoned_carts', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.abandoned_carts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'carts held' AS item, count(*)::text AS detail FROM public.abandoned_carts
UNION ALL
SELECT 'awaiting a first reminder',
       count(*)::text FROM public.abandoned_carts
 WHERE first_sent_at IS NULL AND recovered_at IS NULL AND opted_out = false
UNION ALL
SELECT 'recovered', count(*)::text FROM public.abandoned_carts WHERE recovered_at IS NOT NULL
UNION ALL
SELECT 'opted out', count(*)::text FROM public.abandoned_carts WHERE opted_out
 ORDER BY item;
