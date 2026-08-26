-- Door-to-door vs drop-off (e.g. park) delivery flag for shipping zones.
-- Customers only need to give a street address for door-delivery zones —
-- a park/hub drop-off just needs the state/LGA/district already collected.
-- Run after the other shipping scripts.

ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS is_door_delivery BOOLEAN NOT NULL DEFAULT true;

-- Backfill from the existing free-text delivery_label as a reasonable default
-- (e.g. 'Door-to-door' -> true, 'Park drop-off' -> false). Admin can correct
-- any zone individually afterward in /admin/shipping.
UPDATE public.shipping_zones SET is_door_delivery = (delivery_label ILIKE '%door%');
