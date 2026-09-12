-- ============================================================================
-- The ledger learns 'counter_sale', and adjust_order_stock can say so
-- ----------------------------------------------------------------------------
-- inventory_movements' reason CHECK and record_inventory_movement()'s own
-- allowlist (a defensive second copy — see that function's "a reason the
-- CHECK would refuse must not take the UPDATE down with it") both only know
-- the seven reasons that existed before counter sales did. A counter sale
-- claims stock exactly like an online checkout does, through
-- adjust_order_stock(), which has always labelled every claim 'sale'
-- regardless of caller. Recording a walk-in sale as an online one would make
-- "how much of this did the storefront actually move" silently wrong the
-- first time somebody rings one up.
--
-- So adjust_order_stock() gains a fifth, optional parameter — p_sale_reason —
-- that lets a caller say which kind of sale this is. Every existing caller
-- (checkout, edit_order_items, the reservation sweep) omits it and gets
-- exactly today's behaviour: 'sale' when claiming, 'release' when returning.
-- Only lib/commerce/persist-counter-sale.ts passes 'counter_sale'.
--
-- DROP THEN CREATE, NOT CREATE OR REPLACE
--
-- Adding a parameter changes the function's argument list, which Postgres
-- treats as a different signature — CREATE OR REPLACE would create a second
-- overload alongside the four-argument one rather than replacing it, and
-- PostgREST cannot resolve two overloads of the same name. 20260906120000
-- hit this exact issue widening from two arguments to four and left the note
-- explaining it; this migration follows the same DROP-then-CREATE shape.
--
-- OWNERSHIP: THE PART A DROP/CREATE LOSES SILENTLY
--
-- 20260912100000 reassigned adjust_order_stock() (among others) from postgres
-- to app_service, specifically so its SECURITY DEFINER body runs under the
-- store-scoping RLS policies rather than bypassing them as a superuser-owned
-- function would. A DROP + CREATE here would recreate the function owned by
-- whichever role runs this migration — silently undoing that fix. The ALTER
-- FUNCTION at the end restores it explicitly, so this migration cannot be the
-- one that quietly reopens the gap 20260912100000 closed.
--
-- record_inventory_movement() only gains a new allowed value in its body, not
-- a new parameter, so CREATE OR REPLACE applies there and ownership is
-- preserved automatically — no ALTER FUNCTION needed for it.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reason_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reason_check
  CHECK (reason IN (
    'sale', 'release', 'restock', 'adjustment', 'stock_take', 'variant_edit',
    'return', 'counter_sale'
  ));

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

  IF v_reason NOT IN ('sale', 'release', 'restock', 'adjustment', 'stock_take', 'variant_edit', 'return', 'counter_sale') THEN
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
-- adjust_order_stock() gains p_sale_reason
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID);

CREATE FUNCTION public.adjust_order_stock(
  p_items        JSONB,
  p_reserve      BOOLEAN,
  p_reference_id UUID DEFAULT NULL,
  p_actor_id     UUID DEFAULT NULL,
  -- Which kind of sale this claim is, for the ledger. Ignored when releasing
  -- (a release is always 'release', regardless of what claimed the stock) —
  -- only meaningful alongside p_reserve = true.
  p_sale_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     RECORD;
  v_delta   INTEGER;
  v_have    INTEGER;
  v_name    TEXT;
  v_size    TEXT;
  v_color   TEXT;
  v_label   TEXT;
  v_vid     UUID;
  v_touched INTEGER := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'products_touched', 0);
  END IF;

  PERFORM public.set_inventory_context(
    CASE WHEN p_reserve THEN COALESCE(p_sale_reason, 'sale') ELSE 'release' END,
    CASE WHEN p_reference_id IS NULL THEN NULL ELSE 'order' END,
    p_reference_id,
    p_actor_id,
    NULL
  );

  FOR v_row IN
    SELECT (i->>'product_id')::UUID AS product_id,
           public.variant_key(i->>'size', i->>'color') AS variant_key,
           SUM(COALESCE((i->>'quantity')::INTEGER, 0)) AS qty
      FROM jsonb_array_elements(p_items) AS i
     WHERE (i->>'product_id') IS NOT NULL
     GROUP BY 1, 2
     ORDER BY 1, 2
  LOOP
    IF v_row.qty = 0 THEN
      CONTINUE;
    END IF;

    v_delta := CASE WHEN p_reserve THEN -v_row.qty ELSE v_row.qty END;

    SELECT v.id, v.stock, p.name, v.size, v.color
      INTO v_vid, v_have, v_name, v_size, v_color
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.product_id = v_row.product_id
       AND v.variant_key = v_row.variant_key
       FOR UPDATE OF v;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'That item is no longer available in the selected size or colour.'
        USING ERRCODE = 'GM001';
    END IF;

    v_label := v_name || COALESCE(' (' || NULLIF(concat_ws(' / ', v_size, v_color), '') || ')', '');

    IF p_reserve AND COALESCE(v_have, 0) < v_row.qty THEN
      RAISE EXCEPTION 'Only % left of %.', GREATEST(COALESCE(v_have, 0), 0), v_label
        USING ERRCODE = 'GM001';
    END IF;

    UPDATE public.product_variants
       SET stock = stock + v_delta
     WHERE id = v_vid;

    v_touched := v_touched + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'products_touched', v_touched);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID, TEXT) TO service_role, app_service;

-- Restores what 20260912100000 set: this function's body must run as
-- app_service, not as whichever role happened to push this migration, or the
-- store-scoping RLS policies on product_variants/orders/inventory_movements
-- stop applying inside it. The connecting role needs membership in
-- app_service to reassign ownership to it — 20260912100000 granted that to
-- whichever role ran it; repeated defensively here in case this migration
-- ever runs under a different connection.
DO $$
BEGIN
  EXECUTE format('GRANT app_service TO %I', current_user);
END $$;

ALTER FUNCTION public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID, TEXT) OWNER TO app_service;
