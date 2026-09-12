-- ============================================================================
-- orders learns which channel sold it
-- ----------------------------------------------------------------------------
-- Every order until now was placed online: a customer's own checkout, priced
-- by priceOrder(), paid by transfer or Paystack, and held as a stock
-- reservation until a human (or the provider's webhook) verifies the money.
-- A counter sale rung up in Admin for a walk-in customer is a different shape
-- end to end — paid and handed over in the same moment, no delivery, often no
-- email at all — and nothing on the row said which kind an order was.
--
-- sales_channel is that flag. 'online' is the default, so every existing row
-- reads correctly without a backfill.
--
-- delivery_option / selected_state stay NOT NULL rather than being relaxed.
-- Both are read as real values in a dozen places (order-status.ts's
-- getStatusOptions, every admin component that renders an address) and
-- rippling nullability through all of them for one narrow path is a larger,
-- riskier change than a counter sale needs. It writes real/sentinel values
-- instead: delivery_option = 'pickup' (literally true — the customer takes
-- the goods immediately) and selected_state = 'Counter Sale' (a fixed
-- sentinel, never presented as a place — see OrderPrintDocument.tsx, which
-- suppresses the location line for sales_channel = 'counter').
--
-- orders.payment_method is also widened to match order_payments.method,
-- which has allowed 'cash'/'pos' since 20260905180000 — a counter sale is
-- paid in one of those two ways, and the order row's own payment_method
-- must be able to say so.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online';

DO $$
BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_sales_channel_values
    CHECK (sales_channel IN ('online', 'counter'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.orders.sales_channel IS
  'online = storefront checkout; counter = walk-in sale rung up in Admin. Governs which validation/stock/payment path created the row — see lib/commerce/create-order.ts vs lib/commerce/create-counter-sale.ts.';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_values;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_values
  CHECK (payment_method IN ('transfer', 'paystack', 'cash', 'pos'));

COMMENT ON COLUMN public.orders.payment_method IS
  'transfer = the customer uploads a receipt and an admin verifies it. paystack = card/bank/USSD through the provider, verified by webhook. cash/pos = paid in person at a counter sale, verified at creation. Every existing order is a transfer, which is why that is the default.';
