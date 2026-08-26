-- Timestamped record of every status an order has moved through, so the
-- admin order details view can show when each status change happened (not
-- just the order's single, overwritten-on-any-edit `updated_at`).
-- Populated by lib/commerce/order-status-transition.ts on every transition
-- (manual admin status change or change-request approval) and once at order
-- creation (app/api/orders/route.ts). Run after create-order-change-requests.sql.

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON public.order_status_history (order_id);

-- All access goes through server routes using the service-role client (same
-- as orders/order_change_requests writes already do) — no public policy needed.
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Backfill for orders that already existed before this table did: a 'pending'
-- entry at creation time, plus a second entry for the current status (if it's
-- moved past pending) at the order's last-updated time — an approximation,
-- since intermediate statuses before this table existed were never recorded.
-- Guarded so re-running cannot duplicate history. Without the NOT EXISTS
-- clauses, replaying this migration adds a second copy of every row, and the
-- admin order timeline then shows each status change twice.
INSERT INTO public.order_status_history (order_id, status, changed_at)
SELECT o.id, 'pending', o.created_at
  FROM public.orders o
 WHERE NOT EXISTS (
         SELECT 1 FROM public.order_status_history h
          WHERE h.order_id = o.id AND h.status = 'pending'
       );

INSERT INTO public.order_status_history (order_id, status, changed_at)
SELECT o.id, o.status, o.updated_at
  FROM public.orders o
 WHERE o.status <> 'pending'
   AND NOT EXISTS (
         SELECT 1 FROM public.order_status_history h
          WHERE h.order_id = o.id AND h.status = o.status
       );
