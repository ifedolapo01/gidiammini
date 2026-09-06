-- ============================================================================
-- Running the shop without a deploy
-- ----------------------------------------------------------------------------
-- The numbers a shopkeeper changes are currently spread across places that all
-- require an engineer:
--
--   TAX_RATE = 0.075               a constant in lib/commerce/checkout.ts
--   bank name / account / sort     NEXT_PUBLIC_* environment variables
--   the low-stock threshold        the literal 5 in lib/commerce/stock.ts, the
--                                  literal 10 in the dashboard route, the
--                                  literal 5 in useStock.ts, and a fourth 5
--                                  written into the alert sentence itself
--   'UT' order prefix              a string literal inside reserve_order_number
--
-- None of those are engineering decisions. VAT moves because the government
-- moves it; a bank account changes because the shop changed bank. Needing a
-- pull request for either is a dependency the owner should not have, and the
-- four separate low-stock thresholds are not a configuration story at all --
-- they are a bug that only looks like one when you notice the dashboard says
-- "10 or fewer" and the page it links to says "5 or fewer".
--
-- WHY ONE ROW AND NOT KEY/VALUE
--
-- A settings(key, value) table is the reflex, and it is wrong here. The set of
-- settings is known, small and fixed; a key/value table would give up every
-- type, every CHECK and every default in exchange for flexibility nobody
-- needs, and would push "is tax_rate a number or the string 0.075?" out to
-- each of the dozen callers. Typed columns let the database refuse a tax rate
-- of 750% and an order prefix with a space in it, which is the whole point of
-- having a database.
--
-- Singleton enforced by the primary key: id is a smallint CHECK (id = 1), so a
-- second row is not a bug to be found later, it is an INSERT that fails.
--
-- WHY A PUBLIC VIEW RATHER THAN A PUBLIC TABLE
--
-- The storefront needs the tax rate and the bank details -- it renders both to
-- the shopper already -- and it reads with the anon key. The notification
-- toggles and the audit columns are nobody else's business. So the base table
-- is service-role only, exactly like every other table locked down in
-- 20251101001700, and store_settings_public exposes the shopper-facing columns
-- and nothing else. Adding a genuinely secret setting later (an API key, a
-- margin target) then requires no thought about who can see it: the default is
-- private, and the view is the deliberate act.
--
-- Over the 200-line file limit, deliberately. Splitting it would mean three
-- migrations that must run in a fixed order to leave a working database -- the
-- table, then the view over it, then the function that reads it -- which is a
-- worse thing to hand somebody than one file they can read top to bottom.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Store identity. What the shop calls itself, and how a customer reaches a
  -- human. Not the SEO metadata in app/layout.tsx: that is per-deploy branding
  -- and lives with the code, while these three appear in emails and on
  -- receipts where the owner is the one who should be able to fix a typo.
  store_name    text NOT NULL DEFAULT 'GidiamMini',
  support_email text,
  contact_phone text,

  -- Bank transfer details, shown at checkout and repeated in the payment
  -- reminder. Nullable because a shop that only takes card should not be made
  -- to invent an account number; the checkout hides the panel instead.
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  bank_sort_code      text,

  -- VAT, as a fraction. numeric rather than a percentage integer because 7.5%
  -- is the actual Nigerian rate and 7 is not it -- the column has to be able
  -- to hold the rate that exists.
  tax_rate numeric(6,5) NOT NULL DEFAULT 0.075
    CHECK (tax_rate >= 0 AND tax_rate <= 1),

  -- Spend this much (in whole naira, on the items subtotal) and delivery is
  -- free. Zero means the offer is off, which is why zero is the default: this
  -- column arriving must not quietly change what anybody is charged.
  free_shipping_threshold integer NOT NULL DEFAULT 0
    CHECK (free_shipping_threshold >= 0),

  -- The one low-stock threshold. Every "low stock" claim anywhere in the
  -- product -- badge, dashboard card, stock page filter, alert ticker -- is
  -- this number, so the shop is told the same thing by all four.
  low_stock_threshold integer NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0),

  -- Prefixes every order number. Constrained to something a customer can read
  -- down a phone line and a bank can accept as a transfer remark: no spaces,
  -- no punctuation, short enough to leave the digits legible.
  order_number_prefix text NOT NULL DEFAULT 'UT'
    CHECK (order_number_prefix ~ '^[A-Z0-9]{1,6}$'),

  -- Which notifications go out at all. Off means the shop deals with it by
  -- hand; it does not mean the send silently fails.
  notify_order_received boolean NOT NULL DEFAULT true,
  notify_status_change  boolean NOT NULL DEFAULT true,
  notify_sms            boolean NOT NULL DEFAULT true,
  notify_marketing      boolean NOT NULL DEFAULT true,

  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Who last changed the bank account. audit_log records the request in full,
  -- but the answer to "when did this account number change, and who did it"
  -- should not require a join to find out.
  updated_by uuid
);

COMMENT ON TABLE public.store_settings IS
  'Singleton (id = 1) of the operational settings an owner changes without a deploy. Read through lib/commerce/store-settings-server.ts, which caches it.';
COMMENT ON COLUMN public.store_settings.tax_rate IS
  'VAT as a fraction, e.g. 0.075 for 7.5%. Applied by priceOrder(); never taken from the browser.';
COMMENT ON COLUMN public.store_settings.free_shipping_threshold IS
  'Items subtotal, in whole naira, at or above which the delivery fee is waived. 0 disables it.';
COMMENT ON COLUMN public.store_settings.low_stock_threshold IS
  'The single definition of "low stock" across the storefront badge, the dashboard, the stock page and the alert ticker.';

-- The row itself. ON CONFLICT DO NOTHING so re-running this file never resets
-- a shop that has already set its own values -- the one thing a settings
-- migration must not do.
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Locked down, then reopened for exactly the shopper-facing half
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_settings FROM anon, authenticated;

-- No policies: with RLS on and nothing granted, anon and authenticated can do
-- nothing here. service_role bypasses RLS and needs no policy. Same shape as
-- every other locked table in 20251101001700.

CREATE OR REPLACE VIEW public.store_settings_public
WITH (security_invoker = false) AS
  SELECT
    store_name,
    support_email,
    contact_phone,
    bank_name,
    bank_account_name,
    bank_account_number,
    bank_sort_code,
    tax_rate,
    free_shipping_threshold,
    low_stock_threshold
  FROM public.store_settings
  WHERE id = 1;

COMMENT ON VIEW public.store_settings_public IS
  'The settings a shopper is already shown: store identity, bank transfer details, tax rate, thresholds. security_invoker = false on purpose -- the view owner reads the locked base table so anon does not have to.';

GRANT SELECT ON public.store_settings_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- The order-number prefix stops being a string literal
-- ---------------------------------------------------------------------------
-- Unchanged in every other respect from 20251101002300 -- still idempotent,
-- still INSERT-first so two concurrent callers with the same key cannot both
-- take a sequence value. The only difference is where the two letters in front
-- of the digits come from.
--
-- COALESCE, not a bare SELECT: this function issues the number a customer is
-- told to put on their bank transfer, and it must not start failing because
-- somebody deleted the settings row. A missing row costs the shop its custom
-- prefix, not its checkout.
CREATE OR REPLACE FUNCTION public.reserve_order_number(p_idempotency_key UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT;
  v_prefix       TEXT;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'reserve_order_number requires an idempotency key';
  END IF;

  SELECT r.order_number INTO v_order_number
    FROM public.order_number_reservations r
   WHERE r.idempotency_key = p_idempotency_key;

  IF v_order_number IS NOT NULL THEN
    RETURN v_order_number;
  END IF;

  SELECT COALESCE(s.order_number_prefix, 'UT') INTO v_prefix
    FROM public.store_settings s
   WHERE s.id = 1;
  v_prefix := COALESCE(v_prefix, 'UT');

  INSERT INTO public.order_number_reservations (idempotency_key, order_number)
  VALUES (p_idempotency_key, v_prefix || LPAD(nextval('public.order_number_seq')::TEXT, 8, '0'))
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING order_number INTO v_order_number;

  IF v_order_number IS NULL THEN
    -- Lost the race to a concurrent caller with the same key; use theirs.
    SELECT r.order_number INTO v_order_number
      FROM public.order_number_reservations r
     WHERE r.idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_order_number(UUID) FROM PUBLIC, anon, authenticated;
