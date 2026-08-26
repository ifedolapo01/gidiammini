-- Shipping Zones v2: State/LGA/Places geography, a single "primary" zone flag,
-- and a structured (min, max, unit) delivery ETA replacing the old free-text field.
-- Run this after create-shipping-zones-table.sql has already been applied.

-- 1. Geography columns
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS state TEXT;
UPDATE public.shipping_zones SET state = name WHERE state IS NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN state SET NOT NULL;

ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS lga TEXT;        -- NULL = whole state
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS places TEXT;     -- free text, comma/newline separated; only meaningful when lga is set

-- 2. "Main location" flag — drives the product page's headline delivery estimate.
--    Enforced as a soft singleton at the application layer (admin API unsets it
--    on all other rows whenever a zone is marked primary).
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- 3. Structured delivery ETA, replacing the old free-text delivery_eta column
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS delivery_eta_min INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS delivery_eta_max INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS delivery_eta_unit TEXT NOT NULL DEFAULT 'days'
  CHECK (delivery_eta_unit IN ('days', 'weeks', 'months'));

-- Migrate the originally-seeded rows' free-text ETA into the new structured columns.
UPDATE public.shipping_zones SET delivery_eta_min = 1, delivery_eta_max = 2, is_primary = true WHERE name = 'Abuja';
UPDATE public.shipping_zones SET delivery_eta_min = 3, delivery_eta_max = 5 WHERE name != 'Abuja';

ALTER TABLE public.shipping_zones DROP COLUMN IF EXISTS delivery_eta;

-- 4. The original UNIQUE(name) constraint prevents multiple zones per state,
--    which LGA/place-level zones require (e.g. two "Abuja" zones — one for
--    Kuje LGA, one state-wide). Zone matching now resolves by (state, lga,
--    places) specificity instead of a unique name — see lib/commerce/shipping-match.ts.
ALTER TABLE public.shipping_zones DROP CONSTRAINT IF EXISTS shipping_zones_name_key;

-- NOTE: the originally-seeded "Other" catch-all zone's `state` becomes the
-- literal string 'Other', which isn't a real Nigerian state and so can no
-- longer be selected from the new State dropdown (sourced from
-- lib/data/nigeria-states-lgas.ts). Either delete that row or edit it in
-- /admin/shipping to target a real state once this migration is applied.

-- 5. Record which LGA/place a customer selected on their order (nullable;
--    existing rows are unaffected).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS selected_lga TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS selected_place TEXT;
