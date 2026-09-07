-- ============================================================================
-- Cutoff time and working days per zone
-- ----------------------------------------------------------------------------
-- The zone model already knows a delivery fee and an ETA range, but nothing
-- about when an order actually leaves. "2-4 days" said on a Friday afternoon
-- and "2-4 days" said on a Monday morning are different promises, and neither
-- currently accounts for the zone's own working days -- see
-- lib/commerce/delivery-promise.ts, which turns these two columns plus the
-- existing delivery_eta_min/max/unit into a real calendar date range.
--
--   order_cutoff_time  the last moment (UTC clock time) an order placed today
--                       can still leave today. NULL means no cutoff -- any
--                       order on a working day can dispatch same-day.
--   working_days        ISO weekday numbers (1=Mon .. 7=Sun) this zone
--                       actually dispatches on. Defaults to Mon-Sat, the
--                       existing implicit assumption everywhere else in this
--                       codebase treats a delivery day as landing on.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS order_cutoff_time TIME NULL,
  ADD COLUMN IF NOT EXISTS working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}';

DO $working_days$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'shipping_zones_working_days_not_empty'
       AND conrelid = 'public.shipping_zones'::regclass
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_working_days_not_empty
      CHECK (array_length(working_days, 1) > 0);
  END IF;
END $working_days$;

COMMENT ON COLUMN public.shipping_zones.order_cutoff_time IS
  'UTC clock time an order must be placed by to dispatch the same day. NULL = no cutoff.';
COMMENT ON COLUMN public.shipping_zones.working_days IS
  'ISO weekday numbers (1=Monday .. 7=Sunday) this zone dispatches on. Default is Mon-Sat.';
