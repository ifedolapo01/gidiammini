-- ============================================================================
-- An order says what it costs, not just what it came to
-- ----------------------------------------------------------------------------
-- orders.total_amount is one integer. Everything that produced it -- the line
-- subtotal, the 7.5% tax, the zone's delivery fee -- was computed at checkout
-- by priceOrder() and then thrown away. Three things become impossible the
-- moment that breakdown is gone:
--
--   * Printing an invoice. "Total: 24,500" is not a document anybody can put
--     in a box or hand to an accountant; the tax line and the delivery fee are
--     the two figures a buyer actually queries.
--   * Editing the order. Change a line and the new total is unknowable,
--     because there is no way to tell how much of the old total was shipping.
--     Subtracting the item subtotal from the total works exactly once and
--     drifts on the second edit.
--   * Recording a goodwill discount. There was nowhere to put one, so it was
--     applied by quietly editing the total, which then reconciled against
--     nothing.
--
-- THE INVARIANT
--
--   total_amount = items_subtotal + tax_amount + shipping_amount - discount_amount
--
-- This mirrors priceOrder() exactly (lib/commerce/price-order.ts:
-- subtotal + tax + shipping), plus the manual discount, which only an admin
-- can create. It is enforced by a CHECK constraint below rather than by
-- convention, because a total that disagrees with its own parts is worse than
-- no breakdown at all -- it makes the invoice lie.
--
-- WHY INTEGERS
--
-- total_amount, order_items.price and products.price are all integer Naira
-- (see the baseline). A numeric here would be the only fractional column in
-- the arithmetic and would round somewhere nobody chose. Money that arrives
-- is numeric(12,2) -- see order_payments -- because a bank statement really
-- does have kobo on it; a price this shop sets does not.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS items_subtotal  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0,
  -- Why the shop gave money back on the price. Free text, because a goodwill
  -- discount is a negotiation and no fixed list survives contact with one.
  ADD COLUMN IF NOT EXISTS discount_reason text;

COMMENT ON COLUMN public.orders.items_subtotal IS
  'Sum of order_items.price * quantity. Maintained by edit_order_items(); written at checkout by persistOrderWithReservedStock.';
COMMENT ON COLUMN public.orders.tax_amount IS
  'Tax on items_subtotal at TAX_RATE (lib/commerce/checkout.ts). Recomputed whenever the lines change.';
COMMENT ON COLUMN public.orders.shipping_amount IS
  'The delivery fee that was charged. Survives a line-item edit untouched -- changing what is in the box does not change what the courier costs.';
COMMENT ON COLUMN public.orders.discount_amount IS
  'A manual reduction an admin applied after the fact. Never set by checkout: a catalogue discount is already inside order_items.price.';

-- ---------------------------------------------------------------------------
-- 2. Backfill, so the invariant holds for every order that already exists
-- ---------------------------------------------------------------------------
-- The subtotal is recoverable exactly (it is the sum of the lines) and the tax
-- is a function of it. What is left over is the delivery fee -- except where
-- the total is *lower* than subtotal + tax, which the historical data allows:
-- a few early orders were placed before tax was applied at all. Rather than
-- clamp shipping to zero and leave the row breaking its own constraint, the
-- shortfall is recorded as a discount, which is the honest description of a
-- total below the sum of its parts.
--
-- Only rows still at their defaults are touched, so a re-run cannot overwrite
-- a breakdown that an edit has since refined.
WITH line_totals AS (
  SELECT o.id,
         o.total_amount,
         COALESCE((
           SELECT sum(i.price * i.quantity)::integer
             FROM public.order_items i
            WHERE i.order_id = o.id
         ), 0) AS subtotal
    FROM public.orders o
   WHERE o.items_subtotal = 0
     AND o.tax_amount = 0
     AND o.shipping_amount = 0
     AND o.discount_amount = 0
),
parts AS (
  SELECT id,
         subtotal,
         round(subtotal * 0.075)::integer AS tax
    FROM line_totals
),
balanced AS (
  SELECT p.id,
         p.subtotal,
         p.tax,
         l.total_amount - p.subtotal - p.tax AS remainder
    FROM parts p
    JOIN line_totals l ON l.id = p.id
)
UPDATE public.orders o
   SET items_subtotal  = b.subtotal,
       tax_amount      = b.tax,
       shipping_amount = GREATEST(b.remainder, 0),
       discount_amount = GREATEST(-b.remainder, 0)
  FROM balanced b
 WHERE o.id = b.id;

-- ---------------------------------------------------------------------------
-- 3. Enforce the invariant
-- ---------------------------------------------------------------------------
-- Added only once the data satisfies it. If some row still disagrees the
-- migration warns and moves on rather than failing the whole push: the columns
-- above are useful without the constraint, and a push that dies here would
-- take the tracking and refund migrations behind it down too. The warning
-- names the count so it can be chased.
DO $invariant$
DECLARE
  v_broken integer;
BEGIN
  SELECT count(*) INTO v_broken
    FROM public.orders
   WHERE total_amount <> items_subtotal + tax_amount + shipping_amount - discount_amount;

  IF v_broken > 0 THEN
    RAISE WARNING
      'orders_total_matches_breakdown not added: % order(s) do not balance. Investigate before relying on the invoice.',
      v_broken;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'orders_total_matches_breakdown'
       AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_matches_breakdown
      CHECK (total_amount = items_subtotal + tax_amount + shipping_amount - discount_amount);
  END IF;
END $invariant$;

-- A discount cannot be negative (that would be a surcharge nobody agreed to)
-- and cannot exceed what is being charged for.
DO $bounds$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'orders_discount_within_order'
       AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_within_order
      CHECK (discount_amount >= 0
             AND discount_amount <= items_subtotal + tax_amount + shipping_amount);
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'orders_discount_within_order not added: existing rows violate it.';
END $bounds$;
