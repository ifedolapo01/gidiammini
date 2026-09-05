-- ============================================================================
-- Money going back out becomes a record too
-- ----------------------------------------------------------------------------
-- order_payments made money arriving into a fact: how much, under what
-- reference, on what date, decided by whom. Money leaving had no equivalent.
-- There was no refund concept at all -- a cancelled order that had been paid
-- for was refunded by somebody opening their banking app, and the database
-- went on reporting the full amount as revenue for ever.
--
-- This table is order_payments' mirror image and is deliberately shaped the
-- same way, because the questions asked of it are the same ones:
--
--   * How much went back, and is that all of it or part of it?
--   * Under what reference, so it reconciles against a bank statement?
--   * When did the money actually move, as opposed to when it was agreed?
--   * Why? A refund with no ground cannot be learned from.
--   * Who decided?
--
-- PENDING IS A REAL STATE, WHICH IS WHY THIS DIFFERS FROM order_payments
--
-- A verification is instantaneous: the verifier looks at a receipt and decides.
-- A refund is not. It is agreed now and the transfer happens later, sometimes
-- the next working day, and sometimes it fails and has to be redone. So a row
-- carries a status, and only 'completed' rows count as money returned. An
-- agreed-but-unsent refund is visible on the order without pretending the
-- customer has been paid.
--
-- Unlike order_payments, a row here IS updated in place -- 'pending' becomes
-- 'completed' or 'failed'. That is the same physical event reaching its
-- conclusion, not a revised opinion about it, and splitting it across two rows
-- would double-count the intent. Amount, order and reason are frozen once set;
-- see the trigger at the end.
--
-- WHY orders.amount_refunded IS MAINTAINED BY A TRIGGER
--
-- Same reason as amount_paid: "what does this order still owe / what has it
-- given back" is asked on the order list, on the detail panel and by the
-- revenue figure, and three places recomputing it is three chances to
-- disagree. Net received is amount_paid - amount_refunded.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,

  --   pending   - agreed, money not sent yet.
  --   completed - the transfer left. This is the only status that is money.
  --   failed    - the transfer was attempted and did not land.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),

  -- Naira going back. numeric(12,2) to match order_payments.amount: a partial
  -- refund is routinely a figure with kobo in it (half of an odd total), and
  -- rounding it to whole Naira would silently make the books not add up.
  amount numeric(12,2) NOT NULL CHECK (amount > 0),

  -- How it was sent back. 'paystack' means the provider reversed it; the rest
  -- are somebody moving money by hand.
  method text NOT NULL DEFAULT 'transfer'
    CHECK (method IN ('transfer', 'paystack', 'cash', 'pos', 'store_credit')),

  -- The bank reference of the outgoing transfer, once there is one.
  reference text,

  -- Machine-readable ground, from lib/commerce/refund-reasons.ts. Required,
  -- unlike order_payments.reason_code: there is no such thing as a refund
  -- without a reason, and the aggregate over this column is how the shop finds
  -- out what it keeps paying for.
  reason_code text NOT NULL,

  -- The decider's own words. Shown to the shop; included in the customer's
  -- notification only if they chose to send one.
  note text,

  -- When the money actually moved. NULL while pending -- an agreed refund has
  -- no date yet, and defaulting it to now() would date every refund to the
  -- moment it was promised.
  refunded_at timestamptz,

  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Money that has moved has a date; money that has not, has not.
  CONSTRAINT order_refunds_completed_has_date
    CHECK (status <> 'completed' OR refunded_at IS NOT NULL)
);

COMMENT ON TABLE public.order_refunds IS
  'One row per refund, full or partial. Only status = completed is money actually returned; that is what orders.amount_refunded sums.';

-- "What has this order had back, most recent first" -- the detail panel's
-- own question.
CREATE INDEX IF NOT EXISTS order_refunds_order_idx
  ON public.order_refunds (order_id, created_at DESC);

-- Reconciliation: everything actually paid out in a date range.
CREATE INDEX IF NOT EXISTS order_refunds_settled_idx
  ON public.order_refunds (refunded_at DESC)
  WHERE status = 'completed';

-- "What do we keep refunding, and why" -- the reason this column is NOT NULL.
CREATE INDEX IF NOT EXISTS order_refunds_reason_idx
  ON public.order_refunds (reason_code, created_at DESC);

-- The queue: refunds agreed but not yet sent. Small in a healthy shop, and the
-- thing somebody has to work through at the end of the day.
CREATE INDEX IF NOT EXISTS order_refunds_pending_idx
  ON public.order_refunds (created_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. What the order has given back
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.amount_refunded IS
  'Sum of completed order_refunds.amount for this order, maintained by trigger. Net received is amount_paid - amount_refunded. Never write this directly.';

CREATE OR REPLACE FUNCTION public.sync_order_amount_refunded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  target uuid := COALESCE(NEW.order_id, OLD.order_id);
BEGIN
  UPDATE public.orders o
     SET amount_refunded = COALESCE((
           SELECT sum(r.amount)
             FROM public.order_refunds r
            WHERE r.order_id = target
              AND r.status = 'completed'
         ), 0)
   WHERE o.id = target;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.sync_order_amount_refunded() IS
  'Keeps orders.amount_refunded equal to the sum of that order''s completed refunds. An AFTER trigger returning NULL: it exists for its side effect.';

DROP TRIGGER IF EXISTS order_refunds_sync_amount ON public.order_refunds;

CREATE TRIGGER order_refunds_sync_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_amount_refunded();

-- ---------------------------------------------------------------------------
-- 3. What an update may change
-- ---------------------------------------------------------------------------
-- A refund row is updated to record that the transfer went out, not to revise
-- what was agreed. Freezing the money and the ground means the trail of "we
-- agreed to give back 5,000 because the item was faulty" cannot quietly become
-- "we agreed to give back 500 because they changed their mind" after the fact.
-- Correcting a genuinely wrong amount means failing that row and recording the
-- right one, which is exactly the history worth keeping.
CREATE OR REPLACE FUNCTION public.order_refunds_guard_update()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.reason_code IS DISTINCT FROM OLD.reason_code THEN
    RAISE EXCEPTION 'A refund''s order, amount and reason are fixed once recorded. Fail this one and record another.'
      USING ERRCODE = 'GM004';
  END IF;

  -- A settled refund is finished. Reopening one would let the same money be
  -- counted, uncounted and counted again.
  IF OLD.status IN ('completed', 'failed') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'This refund is already %; record a new one instead of reopening it.', OLD.status
      USING ERRCODE = 'GM004';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS order_refunds_guard ON public.order_refunds;

CREATE TRIGGER order_refunds_guard
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.order_refunds_guard_update();

-- ---------------------------------------------------------------------------
-- 4. Lock it down
-- ---------------------------------------------------------------------------
-- Financial records, written and read by the server under the service role.
-- No browser role gets a grant, matching order_payments.
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'order_refunds'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.order_refunds', r.policyname);
  END LOOP;
END $policies$;

REVOKE ALL ON public.order_refunds FROM anon, authenticated;
