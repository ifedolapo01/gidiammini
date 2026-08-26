-- SQL Setup Script for Shipping Zones
--
-- ⚠️  MUST NOT BE REPLAYED against a database that has already applied
-- 20251101000700. Step 5's seed INSERT names the free-text `delivery_eta`
-- column, which 000700 replaces with delivery_eta_min/max/unit and then DROPs —
-- so replaying this out of order fails with
-- `column "delivery_eta" of relation "shipping_zones" does not exist`.
-- Correct in sequence on a fresh database; guaranteed safe on production only
-- once the migration is marked applied (see migrations/README.md).
-- Run this in the Supabase SQL editor. Replaces the hardcoded state/pickup
-- logic in lib/commerce/checkout.ts with an admin-editable table.

-- 1. Create Shipping Zones table
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,                          -- e.g. 'Abuja' — matches orders.selected_state
    delivery_fee INTEGER NOT NULL DEFAULT 0,
    pickup_available BOOLEAN NOT NULL DEFAULT false,
    pickup_address TEXT,
    contact_phone TEXT,
    delivery_label TEXT NOT NULL DEFAULT 'Delivery',    -- e.g. 'Door-to-door', 'Park drop-off'
    delivery_eta TEXT NOT NULL DEFAULT '',              -- e.g. '3-5 days', 'Park pickup'
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Link orders to the zone they were placed against (nullable so existing
--    rows, which only have the free-text selected_state, keep working)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_zone_id UUID REFERENCES public.shipping_zones(id);

-- 3. Enable Row Level Security
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- 4. Public read policy for active zones only (admin writes go through the
--    service-role client, which bypasses RLS — same pattern as public.discounts)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on active shipping zones') THEN
        CREATE POLICY "Allow public read access on active shipping zones" ON public.shipping_zones FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- 5. Seed today's 6 hardcoded states, preserving current behavior
INSERT INTO public.shipping_zones (name, delivery_fee, pickup_available, pickup_address, contact_phone, delivery_label, delivery_eta, sort_order)
VALUES
('Abuja', 3000, true, 'Suite 5, XYZ Plaza, Central Business District, Abuja', NULL, 'Door-to-door', '3-5 days', 1),
('Lagos', 5000, false, NULL, NULL, 'Park drop-off', 'Park pickup', 2),
('Rivers', 5000, false, NULL, NULL, 'Park drop-off', 'Park pickup', 3),
('Kano', 5000, false, NULL, NULL, 'Park drop-off', 'Park pickup', 4),
('Oyo', 5000, false, NULL, NULL, 'Park drop-off', 'Park pickup', 5),
('Other', 5000, false, NULL, NULL, 'Park drop-off', 'Park pickup', 6)
ON CONFLICT (name) DO NOTHING;
