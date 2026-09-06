-- ============================================================================
-- How long a delivery takes, and how much cover to hold
-- ----------------------------------------------------------------------------
-- The reorder point in lib/commerce/inventory-analytics.ts is
--
--     velocity x (lead days + cover days)
--
-- and neither of those two numbers is knowable from the data. Lead time is a
-- fact about the shop's suppliers -- a local tailor is three days, a container
-- from Guangzhou is eight weeks -- and cover is a judgement about how much
-- money to leave sitting on a shelf. Hardcoding either would make every
-- reorder suggestion wrong for every shop but one, which is worse than making
-- no suggestion.
--
-- They belong in store_settings for the same reason the tax rate does: they
-- change because the business changed, not because the code did. Separate
-- migration from 20260905200000 so a database that has already applied that
-- one is not asked to re-run it.
--
-- The defaults are the ones a Lagos shop buying locally would recognise: two
-- weeks from order to shelf, a month of cover on top. Both deliberately
-- non-zero -- a lead time of 0 would make every reorder point 0 and quietly
-- disable the whole feature.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS reorder_lead_days  integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reorder_cover_days integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.store_settings.reorder_lead_days IS
  'Days between placing a supplier order and the units being on the shelf. Half of the reorder point.';
COMMENT ON COLUMN public.store_settings.reorder_cover_days IS
  'Days of stock to hold beyond the lead time -- the buffer that absorbs a good week.';

-- A year of lead time is a typo, and a typo here silently multiplies every
-- suggested order quantity by twenty-five.
DO $bounds$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_settings_reorder_days_sane'
       AND conrelid = 'public.store_settings'::regclass
  ) THEN
    ALTER TABLE public.store_settings
      ADD CONSTRAINT store_settings_reorder_days_sane
      CHECK (reorder_lead_days BETWEEN 0 AND 365 AND reorder_cover_days BETWEEN 0 AND 365);
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'store_settings_reorder_days_sane not added: the existing row violates it.';
END $bounds$;

-- Not added to store_settings_public. A shopper has no use for the shop's
-- buying policy, and the view is the deliberate act that makes something
-- public -- see the header of 20260905200000.
