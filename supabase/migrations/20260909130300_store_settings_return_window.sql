-- ============================================================================
-- The return window stops being a TS constant
-- ----------------------------------------------------------------------------
-- RETURN_WINDOW_DAYS = 7 has lived in lib/commerce/order-status.ts, and the
-- same "7 days" is hardcoded again as copy in ProductDetailsAccordion.tsx and
-- app/returns/page.tsx — three places that have to be edited together and
-- have no reason to be code at all, for the same reason reorder_lead_days
-- isn't (see 20260906130000's header). Same template as that migration.
--
-- Unlike reorder_lead_days, this IS shown to a shopper already — it is
-- customer-facing policy copy, not an internal buying decision — so it goes
-- into store_settings_public.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS return_window_days integer NOT NULL DEFAULT 7;

COMMENT ON COLUMN public.store_settings.return_window_days IS
  'Days after delivery a customer may request a return. Shown on the product page and the returns policy page, and enforced by canRequestReturn().';

DO $bounds$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_settings_return_window_sane'
       AND conrelid = 'public.store_settings'::regclass
  ) THEN
    ALTER TABLE public.store_settings
      ADD CONSTRAINT store_settings_return_window_sane
      CHECK (return_window_days BETWEEN 1 AND 365);
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'store_settings_return_window_sane not added: the existing row violates it.';
END $bounds$;

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
    low_stock_threshold,
    return_window_days
  FROM public.store_settings
  WHERE id = 1;

GRANT SELECT ON public.store_settings_public TO anon, authenticated;
