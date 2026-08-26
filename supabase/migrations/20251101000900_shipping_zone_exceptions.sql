-- Shipping Zone Exceptions: lightweight fee/ETA carve-outs tied to a parent
-- zone (e.g. "Lagos state-wide, except Ikeja which is cheaper/faster").
-- Run after create-shipping-zones-table.sql and add-shipping-zone-geography-and-eta.sql.

CREATE TABLE IF NOT EXISTS public.shipping_zone_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
    lga TEXT,               -- required when the parent is state-wide (parent.lga IS NULL); if the
                            -- parent is itself LGA-wide, leave NULL to inherit the parent's LGA
    places TEXT,            -- optional, comma/newline separated; narrows within the effective LGA
    delivery_fee INTEGER,             -- NULL = inherit the parent zone's fee
    delivery_eta_min INTEGER,         -- NULL = inherit the parent zone's ETA
    delivery_eta_max INTEGER,
    delivery_eta_unit TEXT CHECK (delivery_eta_unit IN ('days', 'weeks', 'months')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.shipping_zone_exceptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on shipping zone exceptions') THEN
        CREATE POLICY "Allow public read access on shipping zone exceptions" ON public.shipping_zone_exceptions FOR SELECT USING (true);
    END IF;
END $$;
