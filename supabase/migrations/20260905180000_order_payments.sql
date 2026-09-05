-- ============================================================================
-- Money received becomes a record, not a side effect
-- ----------------------------------------------------------------------------
-- Until now the only fact this database held about a manual transfer was
-- orders.payment_verified: one boolean, flipped as a side effect of somebody
-- moving the order to 'confirmed' after eyeballing a screenshot. Everything a
-- shop actually needs to know about a payment was nowhere:
--
--   * How much arrived. A customer who transfers 18,000 against a 20,000
--     order is either confirmed (and the shop eats 2,000) or left pending
--     (and nobody records why) -- there was no third answer.
--   * Which reference it arrived under, so "he says he paid" can be settled
--     against a bank statement without reopening the image.
--   * When it arrived, as opposed to when an admin got round to looking.
--   * That it was refused, and on what grounds. A rejection left no trace at
--     all, so the same bad receipt could be re-examined from scratch the next
--     morning.
--   * That a second payment completed a first. One boolean cannot describe a
--     part payment, a top-up, or a duplicate transfer.
--
-- And because revenue was read off order status, the dashboard counted the
-- full value of every non-cancelled order as money in hand -- including the
-- ones whose money never came.
--
-- ONE ROW PER DECISION, NOT PER PAYMENT
--
-- A rejection is not money, yet it is exactly the event worth keeping. So this
-- table records verification *events*: 'verified' and 'short_paid' carry the
-- amount actually seen, 'rejected' carries 0 and a reason. Revenue is the sum
-- of the first two, which is the definition the dashboard now uses.
--
-- WHY orders.amount_paid IS MAINTAINED BY A TRIGGER
--
-- "How much has this order received" is asked on every row of the verification
-- queue, on the orders list, and by the revenue figure. Recomputing it in each
-- of those is three chances to disagree; recomputing it in application code is
-- a number that drifts the first time a row is inserted from anywhere else. A
-- sum maintained beside its own source cannot drift from it.
--
-- payment_verified is deliberately NOT maintained here. Marking an order paid
-- has consequences a trigger has no business causing -- it confirms the order,
-- which reserves stock and emails the customer -- so that decision stays in
-- lib/commerce/order-payments.ts, where those effects already live.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,

  -- What the verifier decided.
  --   verified   - the expected amount arrived (or more).
  --   short_paid - money arrived, but less than the order.
  --   rejected   - no money is being credited; see reason_code.
  -- Constrained, unlike payment_events.outcome, because this is the record
  -- revenue is computed from: an unrecognised value here would be either
  -- silently counted or silently dropped, and neither is acceptable.
  status text NOT NULL CHECK (status IN ('verified', 'short_paid', 'rejected')),

  -- Naira actually seen, as read off the receipt -- never the order total.
  -- The whole point is that this can differ from what was asked for.
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),

  -- How it arrived, constrained to what this shop actually takes.
  method text NOT NULL DEFAULT 'transfer'
    CHECK (method IN ('transfer', 'paystack', 'cash', 'pos')),

  -- The bank's reference / teller number off the receipt. This is what a
  -- statement is searched by when a payment is disputed.
  reference text,

  -- When the money moved, per the receipt -- not when it was verified. Those
  -- are routinely a day apart, and only the first one reconciles.
  received_at timestamptz NOT NULL DEFAULT now(),

  -- Machine-readable ground for a rejection, from
  -- lib/commerce/payment-rejection.ts. Every code maps to a specific next step
  -- the customer is emailed, which is the difference between a rejection and a
  -- dead end.
  reason_code text,

  -- The verifier's own words, shown to nobody but the shop.
  note text,

  -- The receipt this decision was made against, captured at decision time.
  -- A customer who uploads a corrected receipt replaces orders.receipt_path;
  -- without this snapshot the earlier decision would point at an image that is
  -- no longer the one that was refused.
  receipt_path text,

  -- Who decided. Denormalised email for the same reason
  -- order_status_history.actor_email is: the record must stay readable after
  -- the admin's auth user is gone. A NULL actor means the system did it -- an
  -- online payment confirmed by webhook has no person behind it.
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email text,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- A refusal with no ground is not a record of anything.
  CONSTRAINT order_payments_rejection_has_reason
    CHECK (status <> 'rejected' OR reason_code IS NOT NULL),

  -- Money credited must be money. A 'verified' row of 0 would count toward
  -- revenue while saying that nothing arrived.
  CONSTRAINT order_payments_credit_is_positive
    CHECK (status = 'rejected' OR amount > 0)
);

COMMENT ON TABLE public.order_payments IS
  'One row per payment-verification decision. verified/short_paid rows are money received and are what revenue is summed from; rejected rows are the refusal and its ground. Never updated in place -- a correction is a new row.';

-- "What has this order received, most recent first" -- the queue's own question.
CREATE INDEX IF NOT EXISTS order_payments_order_idx
  ON public.order_payments (order_id, received_at DESC);

-- Reconciliation: everything credited in a date range.
CREATE INDEX IF NOT EXISTS order_payments_received_idx
  ON public.order_payments (received_at DESC)
  WHERE status <> 'rejected';

-- "Who verified this, and what else have they verified."
CREATE INDEX IF NOT EXISTS order_payments_actor_idx
  ON public.order_payments (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- The duplicate-transfer check: the same bank reference used twice is the
-- single most common thing a verifier needs to catch, and a lookup by
-- reference is how they catch it. Not unique -- a legitimate reference can be
-- recorded against a rejection and then again against the correct order.
CREATE INDEX IF NOT EXISTS order_payments_reference_idx
  ON public.order_payments (lower(reference))
  WHERE reference IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. What the order has received
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.amount_paid IS
  'Sum of non-rejected order_payments.amount for this order, maintained by trigger. Compare with total_amount for the outstanding balance. Never write this directly.';

CREATE OR REPLACE FUNCTION public.sync_order_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  target uuid := COALESCE(NEW.order_id, OLD.order_id);
BEGIN
  UPDATE public.orders o
     SET amount_paid = COALESCE((
           SELECT sum(p.amount)
             FROM public.order_payments p
            WHERE p.order_id = target
              AND p.status <> 'rejected'
         ), 0)
   WHERE o.id = target;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.sync_order_amount_paid() IS
  'Keeps orders.amount_paid equal to the sum of that order''s non-rejected payments. An AFTER trigger returning NULL: it exists for its side effect and must not alter the row being written.';

DROP TRIGGER IF EXISTS order_payments_sync_amount_paid ON public.order_payments;

CREATE TRIGGER order_payments_sync_amount_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_amount_paid();

-- ---------------------------------------------------------------------------
-- 3. Carry the history forward
-- ---------------------------------------------------------------------------
-- Every order already marked paid was paid, and a deployment that started
-- counting from zero would report a shop that has never taken any money. So
-- each of those gets the payment row it always implied, dated as accurately as
-- the existing columns allow, and labelled as reconstructed rather than
-- observed -- nobody read an amount off those receipts, so the amount is the
-- order total by assumption.
--
-- Idempotent by the NOT EXISTS: a second run inserts nothing.
INSERT INTO public.order_payments
  (order_id, status, amount, method, reference, received_at, note, receipt_path)
SELECT o.id,
       'verified',
       o.total_amount,
       CASE WHEN o.payment_method = 'paystack' THEN 'paystack' ELSE 'transfer' END,
       o.payment_reference,
       COALESCE(o.paid_at, o.updated_at, o.created_at),
       'Reconstructed when payment records were introduced. The amount is the order total by assumption, not a figure read off a receipt.',
       o.receipt_path
  FROM public.orders o
 WHERE o.payment_verified = true
   AND o.total_amount > 0
   AND NOT EXISTS (
         SELECT 1 FROM public.order_payments p WHERE p.order_id = o.id
       );

-- The trigger only fired for the orders that got a row above; this settles the
-- column for every other order, including a re-run where nothing was inserted.
UPDATE public.orders o
   SET amount_paid = COALESCE((
         SELECT sum(p.amount)
           FROM public.order_payments p
          WHERE p.order_id = o.id
            AND p.status <> 'rejected'
       ), 0)
 WHERE o.amount_paid <> COALESCE((
         SELECT sum(p.amount)
           FROM public.order_payments p
          WHERE p.order_id = o.id
            AND p.status <> 'rejected'
       ), 0);

-- ---------------------------------------------------------------------------
-- 4. Lock it down
-- ---------------------------------------------------------------------------
-- Financial records. Written and read by the server under the service role; no
-- browser role gets a grant, matching payment_events.
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'order_payments'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.order_payments', r.policyname);
  END LOOP;
END $policies$;

REVOKE ALL ON public.order_payments FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'payments by status' AS item,
       status || ': ' || count(*)::text AS detail
  FROM public.order_payments
 GROUP BY status

UNION ALL
SELECT 'money received', to_char(COALESCE(sum(amount), 0), 'FM999G999G999D00')
  FROM public.order_payments
 WHERE status <> 'rejected'

UNION ALL
SELECT 'orders part paid', count(*)::text
  FROM public.orders
 WHERE amount_paid > 0 AND amount_paid < total_amount

 ORDER BY item;
