-- ============================================================================
-- The date an order was actually promised
-- ----------------------------------------------------------------------------
-- priceOrder() resolves a shipping zone for every order and, from this
-- migration on, computes a delivery window from it (see
-- lib/commerce/delivery-promise.ts) at the moment the order is created.
-- Storing that window rather than recomputing it later matters for two
-- reasons: the zone's cutoff/working-days/ETA can change after the order
-- shipped, and "were we late" has to be judged against what the customer was
-- actually told, not against today's configuration.
--
-- NULL for pickup orders and for any order whose zone could not be resolved,
-- mirroring how shipping_zone_id is already nullable.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promised_delivery_start DATE NULL,
  ADD COLUMN IF NOT EXISTS promised_delivery_end   DATE NULL;

COMMENT ON COLUMN public.orders.promised_delivery_start IS
  'Earliest date this order was promised to arrive by, computed and stored at order creation. NULL for pickup or an unresolved zone.';
COMMENT ON COLUMN public.orders.promised_delivery_end IS
  'Latest date this order was promised to arrive by -- the date the "promised vs. actual" report per zone judges lateness against.';
