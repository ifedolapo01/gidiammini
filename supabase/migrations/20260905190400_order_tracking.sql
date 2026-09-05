-- ============================================================================
-- Somewhere to put the waybill number
-- ----------------------------------------------------------------------------
-- The shop already emails "your order has shipped". That email cannot say how
-- to track the parcel, because the database has nowhere to hold a courier or a
-- waybill number -- which guarantees a follow-up message for every single
-- delivery, and guarantees the shop answers it by scrolling back through
-- WhatsApp looking for the number it sent itself.
--
-- Three columns, because a tracking reference is three separate facts:
--
--   carrier         which courier has it. Needed on its own: half the
--                   follow-up questions are "who is bringing it", and the
--                   packing slip has to name them.
--   tracking_number the reference the courier knows it by. This is what a
--                   customer reads out on the phone, and what the shop
--                   searches by when the courier asks.
--   tracking_url    where to look. Derived from the two above for the couriers
--                   in lib/commerce/order-tracking.ts, and stored rather than
--                   derived on read so a courier that later changes its URL
--                   format does not break every historical order.
--
-- WHY NOT A SEPARATE SHIPMENTS TABLE
--
-- One parcel per order is the truth here, and it will be for a long time. A
-- shipments table would be three joins and an empty-collection case on every
-- read, to model a split delivery this shop does not do. When it does, the
-- table arrives and these columns become its backfill.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier         text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url    text;

COMMENT ON COLUMN public.orders.carrier IS
  'Courier key from lib/commerce/order-tracking.ts, or free text for one not in that list.';
COMMENT ON COLUMN public.orders.tracking_number IS
  'The courier''s own reference for this parcel. Uppercased and stripped of spaces by the application so a lookup matches whatever the customer types.';
COMMENT ON COLUMN public.orders.tracking_url IS
  'Where the customer follows the parcel. Stored, not derived, so a courier changing its URL format cannot rewrite history.';

-- A stored URL reaches a customer's inbox as an <a href>. Anything that is not
-- plainly http(s) has no business being there, and a CHECK is the one place
-- that cannot be forgotten by a future caller.
DO $link$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'orders_tracking_url_is_http'
       AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_tracking_url_is_http
      CHECK (tracking_url IS NULL OR tracking_url ~* '^https?://');
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'orders_tracking_url_is_http not added: existing rows violate it.';
END $link$;

-- "Which order is waybill GIG-4471829?" -- the question a courier's own
-- support line asks the shop. Partial, because almost every order has no
-- number until the day it ships.
CREATE INDEX IF NOT EXISTS orders_tracking_number_idx
  ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;
