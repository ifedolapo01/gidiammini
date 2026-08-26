-- Customer-initiated order change requests: reschedule, or switch delivery
-- method (pickup <-> delivery). Every request needs explicit admin
-- approval/rejection before it takes effect. Run after the shipping scripts.

CREATE TABLE IF NOT EXISTS public.order_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('reschedule', 'delivery_method_change')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    -- Shape depends on request_type:
    --   reschedule              -> { "preferredDate": "2026-08-01" }
    --   delivery_method_change  -> { "newDeliveryOption": "pickup"|"delivery", "deliveryAddress"?: string, "city"?: string }
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer_note TEXT,
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- All access goes through server routes using the service-role client (same
-- as orders/shipping_zones writes already do) — no public policy needed.
ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;
