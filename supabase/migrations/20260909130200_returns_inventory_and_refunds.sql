-- ============================================================================
-- Returns rejoin the two ledgers they need to affect
-- ----------------------------------------------------------------------------
-- inventory_movements and order_refunds both predate returns having a table
-- of their own (20260909130000) and neither knew a 'return' was coming:
-- inventory_movements' reason and reference_type CHECKs did not list it, and
-- order_refunds had no way to point back at the return that produced it.
--
-- restock_return_item is the "plumbing that already exists" the return
-- lifecycle calls on its 'restocked' step: it credits stock the same way
-- set_variant_stock does (an UPDATE the trigger on product_variants.stock
-- turns into a movement row automatically — see 20260906120000's header for
-- why that is a trigger and not a write here), and it is idempotent, guarded
-- by requiring the return to be 'inspected' and by only ever touching a
-- return_items row once.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reason_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reason_check
  CHECK (reason IN ('sale', 'release', 'restock', 'adjustment', 'stock_take', 'variant_edit', 'return'));

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reference_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reference_type_check
  CHECK (reference_type IS NULL OR reference_type IN ('order', 'return'));

-- Nullable: most refunds have nothing to do with a return (a shipping
-- adjustment, a goodwill gesture), and a return's refund does not exist until
-- the 'restocked' step records one.
ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES public.returns (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_refunds_return_idx
  ON public.order_refunds (return_id)
  WHERE return_id IS NOT NULL;

COMMENT ON COLUMN public.order_refunds.return_id IS
  'Set when this refund was recorded by a return reaching restocked. Settling it (see refund-settlement.ts) is what flips returns.status to refunded.';

-- ---------------------------------------------------------------------------
-- Restocking a return
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restock_return_item(
  p_return_id uuid,
  p_actor_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  text;
  v_row     RECORD;
  v_vid     uuid;
  v_touched integer := 0;
BEGIN
  -- Locked for the length of the transaction, so a double-click cannot have
  -- both requests read 'inspected' before either has written 'restocked'.
  SELECT status INTO v_status FROM public.returns WHERE id = p_return_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That return no longer exists.' USING ERRCODE = 'GM006';
  END IF;

  IF v_status <> 'inspected' THEN
    RAISE EXCEPTION 'This return is %, not inspected — it cannot be restocked from here.', v_status
      USING ERRCODE = 'GM006';
  END IF;

  FOR v_row IN
    SELECT ri.id AS return_item_id, ri.quantity, oi.product_id, oi.size, oi.color
      FROM public.return_items ri
      JOIN public.order_items oi ON oi.id = ri.order_item_id
     WHERE ri.return_id = p_return_id AND ri.restocked = false
     ORDER BY ri.id
  LOOP
    -- A line whose product was later deleted from the catalogue has nothing
    -- to credit stock against. Mark it done rather than fail the whole
    -- return over one line that cannot be reconciled.
    IF v_row.product_id IS NOT NULL THEN
      SELECT v.id INTO v_vid
        FROM public.product_variants v
       WHERE v.product_id = v_row.product_id
         AND v.variant_key = public.variant_key(v_row.size, v_row.color)
       FOR UPDATE;

      IF FOUND THEN
        PERFORM public.set_inventory_context('return', 'return', p_return_id, p_actor_id, NULL);
        UPDATE public.product_variants SET stock = stock + v_row.quantity WHERE id = v_vid;
      END IF;
    END IF;

    UPDATE public.return_items SET restocked = true WHERE id = v_row.return_item_id;
    v_touched := v_touched + 1;
  END LOOP;

  UPDATE public.returns
     SET status = 'restocked', restocked_at = now(), actor_id = p_actor_id, updated_at = now()
   WHERE id = p_return_id;

  RETURN jsonb_build_object('ok', true, 'items_restocked', v_touched);
END;
$$;

REVOKE ALL ON FUNCTION public.restock_return_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restock_return_item(uuid, uuid) TO service_role;
