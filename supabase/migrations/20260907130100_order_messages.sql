-- ============================================================================
-- A conversation that lives with the order, not in a chat app
-- ----------------------------------------------------------------------------
-- Every change request already carries a customer_note and an admin_response,
-- but that is one message each way per request — not a thread, and nothing
-- exists once the request is resolved. This is the general version: either
-- side can post a message against the order at any time, and it's ordered by
-- when it happened rather than tied to a particular request.
--
-- No admin/customer identity columns beyond `sender` -- a shop this size has
-- one admin voice, not several, and which admin account posted is already in
-- audit_log for the same reason every other admin action is.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'admin')),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_messages_order_idx
  ON public.order_messages (order_id, created_at);

COMMENT ON TABLE public.order_messages IS
  'A running conversation on one order. Read/written only through the server -- see app/api/orders/[id]/messages and app/api/orders/messages.';

-- Same trust model as order_change_requests and order_status_history: every
-- read and write goes through a server route under the service role. No
-- policy needed for anon/authenticated to use this table directly.
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The admin doorbell: "a message landed", never the message itself
-- ---------------------------------------------------------------------------
-- Same shape as 20260905140100_admin_realtime_reads.sql: the admin browser is
-- allowed to see that *a* row changed, on a handful of non-identifying
-- columns, and refetches the actual content through the audited service-role
-- API. `body` and anything naming the customer are deliberately withheld —
-- even with the SELECT policy in place, the realtime event carries nothing
-- worth having on its own.
DROP POLICY IF EXISTS admin_realtime_read ON public.order_messages;
CREATE POLICY admin_realtime_read
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

GRANT SELECT (id, order_id, sender, created_at) ON public.order_messages TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'No supabase_realtime publication here; skipping realtime setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages';
  END IF;
END $$;
