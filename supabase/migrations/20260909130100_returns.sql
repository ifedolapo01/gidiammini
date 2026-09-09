-- ============================================================================
-- Returns get a real lifecycle
-- ----------------------------------------------------------------------------
-- A return today is a row in order_change_requests: an item-id array, a
-- free-text reason, and a flat pending/approved/rejected status shared with
-- seven other request types. Approving one fires a refund immediately — there
-- is no "we received it", no inspection gate, and nothing ever restocks the
-- returned units, which is exactly the kind of quiet drift that poisons the
-- reorder-point maths (see 20260906130000_reorder_policy_settings.sql).
--
-- This promotes returns to their own table with a real lifecycle:
--
--   requested -> approved -> received -> inspected -> restocked | rejected
--
-- restocked advances to refunded indirectly, through the existing refund
-- pending/settled flow (order_refunds.return_id below) — not a sixth manual
-- admin button. See 20260909130100 for the restock function that writes the
-- inventory_movements row and 20260909130200 for the return_window_days
-- setting the submission endpoint enforces.
--
-- order_change_requests keeps 'return_request' in its type/status vocabulary,
-- read-only, so historical rows and their audit entries still render — new
-- submissions go through this table instead.
--
-- WHY A CHILD TABLE FOR ITEMS, NOT A JSONB ARRAY
--
-- order_change_requests.details stores { orderItemIds: uuid[], reason } as
-- JSONB because nothing in that flow needs per-item state. A return does: a
-- partial-quantity return needs a quantity per line, and the inspection step
-- needs to know which lines have already been restocked so a second restock
-- attempt cannot double-credit stock. That is exactly what a table is for.
--
-- Safe to run more than once.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.rma_number_seq;

CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stamped by the trigger below, on insert only. Never client-supplied.
  rma_number text UNIQUE,

  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'received', 'inspected', 'restocked', 'rejected', 'refunded'
  )),

  reason text NOT NULL,
  admin_response text,

  -- Set once the 'restocked' action records a pending refund (see
  -- lib/commerce/return-lifecycle.ts). NULL means either no refund yet, or —
  -- for a rejected return — none is coming. Settling this refund is what
  -- flips status to 'refunded'; see the settle-side update in
  -- lib/commerce/refund-settlement.ts.
  refund_id uuid REFERENCES public.order_refunds (id) ON DELETE SET NULL,

  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  received_at timestamptz,
  inspected_at timestamptz,
  restocked_at timestamptz,
  rejected_at timestamptz,
  refunded_at timestamptz,

  -- The admin behind the most recent transition. auth.users.id, matching the
  -- other admin-attribution columns in this schema (inventory_movements,
  -- order_refunds); left as a plain uuid rather than a foreign key for the
  -- same reason those are — an admin account can be removed without
  -- orphaning history.
  actor_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns (id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE CASCADE,

  -- Never more than what was actually bought on that line, and never more
  -- than what is left after any other active return already claimed —
  -- enforced in lib/commerce/returns.ts, since a CHECK here cannot see
  -- sibling rows on order_items or other returns.
  quantity integer NOT NULL CHECK (quantity > 0),

  -- Per-line restock state, so a return can be partially processed (one line
  -- passes inspection, another does not) and so restock_return_item below is
  -- idempotent — a second call finds nothing left to restock rather than
  -- crediting stock twice.
  restocked boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (return_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS returns_order_idx ON public.returns (order_id, created_at DESC);

-- The admin worklist's "what needs a decision" query — everything that has
-- not reached one of the two terminal states.
CREATE INDEX IF NOT EXISTS returns_open_idx
  ON public.returns (status, created_at)
  WHERE status NOT IN ('refunded', 'rejected');

CREATE INDEX IF NOT EXISTS return_items_return_idx ON public.return_items (return_id);

COMMENT ON TABLE public.returns IS
  'A customer return with a real lifecycle: requested -> approved -> received -> inspected -> restocked|rejected, then refunded via the existing refund settle flow. Replaces new return_request submissions on order_change_requests, which keeps the type read-only for history.';
COMMENT ON COLUMN public.returns.rma_number IS
  'RA + 8 digits, stamped once by returns_set_rma_number. Mirrors order-number.ts''s shape, not its reservation machinery — a return has no pre-row-existence deadline and no client-retry scenario to protect against.';

-- ---------------------------------------------------------------------------
-- The RMA number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_rma_number() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rma_number IS NULL THEN
    NEW.rma_number := 'RA' || LPAD(nextval('public.rma_number_seq')::TEXT, 8, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS returns_set_rma_number ON public.returns;
CREATE TRIGGER returns_set_rma_number
  BEFORE INSERT ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.set_rma_number();

-- ---------------------------------------------------------------------------
-- Creating a return: one row on returns, one per line, one transaction
-- ---------------------------------------------------------------------------
-- PostgREST cannot insert into two tables in one call, so this is the
-- transactional entry point lib/commerce/returns.ts uses. Eligibility (is
-- this order returnable, are these really its items, is there already an
-- active return) is checked in TypeScript, where the error messages live —
-- this function trusts its caller the same way adjust_order_stock trusts
-- edit_order_items to have already resolved what it is asking for.
CREATE OR REPLACE FUNCTION public.create_return(
  p_order_id uuid,
  p_reason   text,
  -- [{ "order_item_id": uuid, "quantity": int }, ...]
  p_items    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return_id uuid;
  v_rma       text;
  v_row       RECORD;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Choose at least one item to return.' USING ERRCODE = 'GM006';
  END IF;

  INSERT INTO public.returns (order_id, reason)
  VALUES (p_order_id, p_reason)
  RETURNING id, rma_number INTO v_return_id, v_rma;

  FOR v_row IN
    SELECT (i->>'order_item_id')::uuid AS order_item_id,
           (i->>'quantity')::integer AS quantity
      FROM jsonb_array_elements(p_items) AS i
  LOOP
    INSERT INTO public.return_items (return_id, order_item_id, quantity)
    VALUES (v_return_id, v_row.order_item_id, v_row.quantity);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'return_id', v_return_id, 'rma_number', v_rma);
END;
$$;

REVOKE ALL ON FUNCTION public.create_return(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_return(uuid, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Lock it down
-- ---------------------------------------------------------------------------
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.returns FROM anon, authenticated;
REVOKE ALL ON public.return_items FROM anon, authenticated;
-- No policies. RLS on with nothing granted means anon and authenticated can do
-- nothing; service_role bypasses RLS. Same shape as order_change_requests and
-- inventory_movements — both customer submission and admin actions go through
-- server routes only.

-- ---------------------------------------------------------------------------
-- Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'returns' AS item, count(*)::text || ' on record' AS detail FROM public.returns;
