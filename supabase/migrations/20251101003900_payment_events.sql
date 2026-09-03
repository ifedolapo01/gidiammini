-- ============================================================================
-- What the payment provider actually said
-- ----------------------------------------------------------------------------
-- 20251101003800 deliberately shipped without this, on the grounds that
-- idempotency does not need it — the guard is orders.payment_verified, a fact
-- that cannot drift from itself — and that a table of somebody else's JSON was
-- evidence for a problem this shop did not yet have.
--
-- Adding it now, on purpose rather than by default. What it buys:
--
--   * A dispute has an answer. "He says he paid" is settled by the provider's
--     own message, with its reference, channel, amount and timestamp, rather
--     than by logging into their dashboard and hoping the row is still there.
--   * A failed confirmation is visible. If finalizePayment throws — a mail
--     server, a stock error — the money arrived and the order did not move.
--     Today that is one line in a server log that scrolls away; here it is a
--     row with outcome 'error' that can be found later.
--   * Reconciliation. Every confirmed payment, in one place, matched against
--     the orders it confirmed.
--
-- ONLY AUTHENTIC EVENTS ARE STORED
--
-- The webhook endpoint is public: anyone can POST to it. Logging rejected
-- attempts would be the more obvious security choice and is the wrong one —
-- it turns an unauthenticated endpoint into an unbounded write, and a
-- stranger could fill this table by looping. So a request whose HMAC does not
-- verify is counted in the server log and dropped. Everything stored here was
-- signed with the secret key and is therefore genuinely from Paystack.
--
-- NO CARD NUMBERS
--
-- The payload is what the provider sends, which never contains a PAN or a CVV
-- — their authorization object carries a bin, last4, card type and bank. That
-- is worth keeping (it is how a customer's "which card did I use" is answered)
-- and is not card data anybody can spend.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /** Room for a second provider without a migration. */
  provider text NOT NULL DEFAULT 'paystack',

  /** The provider's event name, e.g. 'charge.success'. */
  event text NOT NULL,

  /** Our reference: "<order number>-<random>". */
  reference text NOT NULL,

  /** The provider's own transaction id, which is what their support asks for. */
  transaction_id text,

  /** Set when the reference resolved to an order. Null means it did not — a
   *  payment for an order that no longer exists is exactly the kind of thing
   *  this table is here to make findable. */
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,

  /** In kobo, as sent. Kept beside the payload so a mismatch can be found with
   *  a WHERE clause rather than by digging through JSON. */
  amount_kobo integer,

  /** What finalizePayment decided: confirmed, already_paid, amount_mismatch,
   *  order_not_found, not_paid, or error. Free text rather than a CHECK: this
   *  is a log, and a new outcome must never be the reason a payment fails to
   *  be recorded. */
  outcome text NOT NULL,

  /** The message as received. */
  payload jsonb NOT NULL,

  received_at timestamptz NOT NULL DEFAULT now()
);

-- "Show me everything about this reference" — the support question.
CREATE INDEX IF NOT EXISTS payment_events_reference_idx
  ON public.payment_events (reference, received_at DESC);

-- "Show me every payment message about this order."
CREATE INDEX IF NOT EXISTS payment_events_order_idx
  ON public.payment_events (order_id, received_at DESC)
  WHERE order_id IS NOT NULL;

-- The reconciliation and triage queries: what went wrong lately.
CREATE INDEX IF NOT EXISTS payment_events_outcome_idx
  ON public.payment_events (outcome, received_at DESC);

-- Retries are normal — a provider resends until it gets a 200 — and each is a
-- separate delivery of the same event. One row per delivery would be noise, so
-- a repeat of the same transaction and outcome collapses into the first.
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_once_idx
  ON public.payment_events (provider, transaction_id, event, outcome)
  WHERE transaction_id IS NOT NULL;

COMMENT ON TABLE public.payment_events IS
  'Signature-verified webhook messages from the payment provider, with what the system did about each. Only authentic events are stored — see the migration header for why rejected ones are not. Never pruned: one row per payment, growing no faster than orders.';

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
-- Financial records with customer emails in them. Written by the webhook under
-- the service role; read by whoever is answering a dispute.
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'payment_events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.payment_events', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.payment_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT COALESCE(outcome, 'none') AS item, count(*)::text AS detail
  FROM public.payment_events
 GROUP BY outcome
 ORDER BY item;
