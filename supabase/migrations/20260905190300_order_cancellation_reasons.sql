-- ============================================================================
-- Why an order died becomes an answerable question
-- ----------------------------------------------------------------------------
-- Cancelling was a window.confirm and a stock restore. 20260905170100 added a
-- free-text `reason` to order_status_history, which is a real improvement for
-- "why was THIS one cancelled" and no help at all for "why do orders get
-- cancelled here". Free text does not aggregate: "no stock", "out of stock",
-- "oos" and "we don't have it" are four answers to one question.
--
-- So a cancellation now carries a code from a fixed vocabulary
-- (lib/commerce/cancellation-reasons.ts) *and* the free text. The code is what
-- can be counted; the sentence is what a person actually needed to say.
--
-- WHY ON order_status_history AND NOT ON orders
--
-- A column on orders would be simpler to query and would be wrong twice over:
-- it would have nowhere to live for the statuses that are not cancellation
-- (a reschedule has a reason too), and it would put a fact about one
-- transition on a row that describes the order's current state. The history
-- table already holds who, when and why; the code belongs beside them.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS reason_code text;

COMMENT ON COLUMN public.order_status_history.reason_code IS
  'Machine-readable ground for this transition, from lib/commerce/cancellation-reasons.ts. Deliberately unconstrained: a code this build does not know is data from a newer deployment, not corruption, and refusing it would fail the cancellation itself.';

-- The analytics query: every cancellation, grouped by ground. Partial, because
-- the overwhelming majority of history rows are ordinary forward transitions
-- with no code at all.
CREATE INDEX IF NOT EXISTS order_status_history_reason_code_idx
  ON public.order_status_history (reason_code, changed_at DESC)
  WHERE reason_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- One row per cancelled order, with its ground
-- ---------------------------------------------------------------------------
-- The join is not trivial enough to retype at every call site: a cancellation
-- is the *latest* 'cancelled' entry for the order, because a pre-history
-- backfill (20251101001200) can have left an approximate one behind it.
--
-- Deliberately per-order rather than pre-aggregated. "How many cancellations
-- were 'out of stock' last month" and "which cancellations were 'out of stock'"
-- are both asked, and a rollup can only answer the first. Grouping this is one
-- GROUP BY; ungrouping a rollup is impossible.
--
-- security_invoker for the same reason customer_stats has it: a view over
-- RLS-protected tables that runs as its owner is a hole straight through that
-- protection. Requires PostgreSQL 15+; this database is 17.
CREATE OR REPLACE VIEW public.order_cancellations
WITH (security_invoker = true) AS
SELECT
  o.id                AS order_id,
  o.order_number,
  o.customer_id,
  o.customer_email,
  o.total_amount,
  o.amount_paid,
  o.amount_refunded,
  o.created_at        AS ordered_at,
  h.changed_at        AS cancelled_at,
  h.reason_code,
  h.reason,
  h.actor_email       AS cancelled_by
FROM public.orders o
JOIN LATERAL (
  SELECT s.changed_at, s.reason_code, s.reason, s.actor_email
    FROM public.order_status_history s
   WHERE s.order_id = o.id
     AND s.status = 'cancelled'
   ORDER BY s.changed_at DESC
   LIMIT 1
) h ON true
WHERE o.status = 'cancelled';

COMMENT ON VIEW public.order_cancellations IS
  'Every cancelled order with the ground it was cancelled on, taken from the latest cancelled entry in its status history. Group by reason_code for the breakdown.';

REVOKE ALL ON public.order_cancellations FROM anon, authenticated;
