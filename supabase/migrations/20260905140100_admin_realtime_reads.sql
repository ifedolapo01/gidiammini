-- ============================================================================
-- Let an admin's browser subscribe to order and stock changes
-- ----------------------------------------------------------------------------
-- Realtime enforces RLS, so a browser can only be told a row changed if that
-- browser's identity is allowed to select it. 20251101001700 revoked every
-- anon/authenticated grant on `orders` because the anon key could read the
-- whole order history, receipts included — that decision stands, and none of
-- it is undone here.
--
-- What makes this safe is that the browser is being given a doorbell, not a
-- key. The admin UI never renders a realtime payload: an event only tells the
-- page "something moved", and the page then refetches through the existing
-- service-role API, which is also what keeps every read audited and paginated.
-- So the grants below are COLUMN-level and deliberately exclude every piece of
-- customer data — no name, email, phone, address, receipt path or amount. Even
-- with the policy removed, this grant would leak nothing worth having.
--
-- If a realtime event never arrives, the admin pages fall back to the change-
-- cursor poll they already use, so a misconfiguration degrades to the previous
-- behaviour rather than to a silently stale screen.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who may see a change
-- ---------------------------------------------------------------------------
-- SELECT only. Writes stay on the server behind withAdminAuth, which is what
-- guarantees every change reaches audit_log — a browser that could write
-- directly to these tables could act without leaving a trace.
DROP POLICY IF EXISTS admin_realtime_read ON public.orders;
CREATE POLICY admin_realtime_read
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS admin_realtime_read ON public.product_variants;
CREATE POLICY admin_realtime_read
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- 2. Which columns a change may mention
-- ---------------------------------------------------------------------------
-- The change-signal columns and nothing else. `status` and `payment_verified`
-- are included so a future refinement can ignore events that cannot matter,
-- without another migration; neither identifies a customer.
GRANT SELECT (id, status, payment_verified, created_at, updated_at)
  ON public.orders TO authenticated;

GRANT SELECT (id, product_id, variant_key, stock, updated_at)
  ON public.product_variants TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publish the two tables
-- ---------------------------------------------------------------------------
-- Guarded twice over: the publication only exists on a real Supabase database
-- (a rebuild onto bare PostgreSQL, which supabase/migrations/README.md checks,
-- has no supabase_realtime), and ALTER PUBLICATION ... ADD TABLE errors if the
-- table is already a member.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'No supabase_realtime publication here; skipping realtime setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_variants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants';
  END IF;
END $$;
