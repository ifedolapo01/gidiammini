-- ============================================================================
-- Pay now, as well as pay by transfer
-- ----------------------------------------------------------------------------
-- Until now there was one way to pay: read the account details, leave for a
-- banking app, screenshot the receipt, come back, upload it — then wait, up to
-- a day, for somebody to look at the screenshot. That wait is where the
-- support messages live, and it is why this shop needed a payment-reminder
-- cron at all. On the shop's side it is the largest recurring cost in the
-- whole operation: a human inspecting an image on every single order.
--
-- BESIDE, NOT INSTEAD OF
--
-- Manual transfer stays exactly as it is. Plenty of customers here prefer it,
-- some do not have a card, and a checkout that removes the familiar option to
-- add a new one loses the buyers it was meant to keep. What changes is that
-- there is now a second column: card, bank, USSD or transfer through the
-- provider, verified automatically.
--
-- WHAT THIS MIGRATION ADDS
--
-- Four columns on orders, and nothing else. The status machine, the stock
-- reservation, the notification pipeline and the receipt workflow are all
-- unchanged — an online payment simply arrives at the same place a verified
-- transfer does: payment_verified true, status 'confirmed'.
--
-- WHY NOT A payment_events TABLE
--
-- Considered and deliberately left out. Idempotency does not need one: the
-- webhook's guard is orders.payment_verified, which is the fact that actually
-- matters and cannot drift from itself. A log of raw provider payloads would
-- be useful for reconciliation, and it is the obvious next step if disputes
-- ever become a thing here — but it is a table of somebody else's JSON, and
-- adding it now would be storing evidence for a problem this shop does not yet
-- have.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. How this order is being paid for
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'transfer';

DO $$
BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_values
    CHECK (payment_method IN ('transfer', 'paystack'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.orders.payment_method IS
  'transfer = the customer uploads a receipt and an admin verifies it. paystack = card/bank/USSD through the provider, verified by webhook. Every existing order is a transfer, which is why that is the default.';

-- ---------------------------------------------------------------------------
-- 2. The provider's handle on this payment
-- ---------------------------------------------------------------------------
-- Shaped "<order number>-<random>", so a webhook can always recover the order
-- even if the customer paid an older attempt than the one this column holds:
-- match the reference exactly, and fall back to the order number in front of
-- the dash. Order numbers are UT + 8 digits and contain no dash, which is what
-- makes that parse unambiguous.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Not unique. A customer who abandons a payment and starts again produces a
-- second reference for the same order, and this column holds the latest; the
-- uniqueness that matters is Paystack's, on their side.
CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 'card', 'bank', 'ussd', 'bank_transfer' — whatever the provider reports.
-- Free text on purpose: it is their vocabulary, not ours, and a CHECK here
-- would fail an order the day they add a channel.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;

COMMENT ON COLUMN public.orders.payment_reference IS
  'The provider''s transaction reference for the most recent payment attempt. Format: <order_number>-<random>.';
COMMENT ON COLUMN public.orders.paid_at IS
  'When the provider confirmed the money. NULL for an unpaid order and for every manual transfer — those are verified by a human, and payment_verified is the flag that records it.';
COMMENT ON COLUMN public.orders.payment_channel IS
  'How they paid, in the provider''s words: card, bank, ussd, bank_transfer. Shown to the admin so "he says he paid by transfer" can be checked.';

-- ---------------------------------------------------------------------------
-- 3. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'orders by payment method' AS item,
       payment_method || ': ' || count(*)::text AS detail
  FROM public.orders
 GROUP BY payment_method

UNION ALL
SELECT 'paid online', count(*)::text
  FROM public.orders
 WHERE paid_at IS NOT NULL
 ORDER BY item;
