-- ============================================================================
-- The inventory movement trigger learns about 'return' too
-- ----------------------------------------------------------------------------
-- 20260909130200_returns_inventory_and_refunds.sql widened
-- inventory_movements_reason_check to allow 'return' — but missed that the
-- CHECK is not the only place validating a reason. record_inventory_movement()
-- (20260906120000) carries its own hardcoded allowlist as a defensive measure
-- ("a reason the CHECK would refuse must not take the UPDATE down with it"),
-- and that list still only knew the original six. The effect: a restock via
-- restock_return_item wrote its movement as 'adjustment' instead of 'return',
-- silently and without error — set_inventory_context passed 'return' through
-- correctly, but the trigger's own guard downgraded it before the INSERT,
-- exactly as its RAISE WARNING says it will for anything unrecognised.
--
-- Caught by testing the restock step end-to-end: the row landed with
-- reason = 'adjustment', reference_type = 'return' (that field has no such
-- guard) — a return that had visibly restocked stock while its ledger entry
-- quietly misreported why.
--
-- Only the allowlist changes; the rest of the function is unchanged from
-- 20260906120000.
--
-- Safe to run more than once.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta  integer;
  v_reason text;
BEGIN
  v_delta := NEW.stock - COALESCE(OLD.stock, 0);

  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  v_reason := COALESCE(public.inventory_context('reason'), 'adjustment');

  IF v_reason NOT IN ('sale', 'release', 'restock', 'adjustment', 'stock_take', 'variant_edit', 'return') THEN
    RAISE WARNING 'Unknown inventory reason %, recording as adjustment', v_reason;
    v_reason := 'adjustment';
  END IF;

  INSERT INTO public.inventory_movements (
    variant_id, product_id, delta, stock_after,
    reason, reference_type, reference_id, actor_id, note
  ) VALUES (
    NEW.id,
    NEW.product_id,
    v_delta,
    NEW.stock,
    v_reason,
    public.inventory_context('reference_type'),
    public.inventory_context('reference_id')::uuid,
    public.inventory_context('actor_id')::uuid,
    public.inventory_context('note')
  );

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Repair the one row this bug produced during testing, if it's still there
-- ---------------------------------------------------------------------------
UPDATE public.inventory_movements
   SET reason = 'return'
 WHERE reference_type = 'return'
   AND reason = 'adjustment';
