-- ============================================================================
-- Stock reservation at order creation
-- ----------------------------------------------------------------------------
-- Before this migration, stock was only decremented when an admin moved an
-- order off 'pending' (lib/commerce/order-status-transition.ts). Between a
-- customer paying and an admin verifying the receipt — hours or days — the
-- same unit could be sold repeatedly.
--
-- This adds:
--   1. orders.stock_reserved  — explicit record of whether this order is
--      currently holding inventory, rather than inferring it from `status`.
--   2. orders.reserved_until  — when an unverified reservation may be swept.
--   3. adjust_order_stock()   — a single atomic, variant-aware, row-locked
--      function that both claims and releases stock.
--
-- NOTE on the pre-existing `check_and_decrease_stock_multi`: it is NOT used and
-- is not usable. It compares products.id (uuid) against a jsonb-extracted text
-- without a cast, so it raises `operator does not exist: uuid = text` on any
-- non-empty input, and its {product_id, quantity} signature has no size/color,
-- so it could never touch the pricing_config variant buckets that
-- getVariantStock() actually reads. Left in place (its only callers are the two
-- dead createOrder functions) but superseded by adjust_order_stock below.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reservation bookkeeping on orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

-- Backfill so the new explicit column agrees with what the old inferred logic
-- (hasStockReserved: status is neither 'pending' nor 'cancelled') had already
-- done. Without this, confirming an existing order would decrement stock a
-- second time, and cancelling one would restore stock that was never taken.
--
-- Existing 'pending' rows deliberately stay false: their stock genuinely was
-- never claimed, so the first transition off 'pending' still claims it.
UPDATE public.orders
   SET stock_reserved = true
 WHERE stock_reserved = false
   AND status NOT IN ('pending', 'cancelled');

CREATE INDEX IF NOT EXISTS orders_reservation_sweep_idx
  ON public.orders (reserved_until)
  WHERE stock_reserved = true AND status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Atomic, variant-aware stock adjustment
-- ---------------------------------------------------------------------------
-- p_items:   [{ "product_id": uuid, "size": text|null, "color": text|null,
--               "quantity": int }, ...]
-- p_reserve: true  = claim stock (decrement), refusing to oversell
--            false = release stock (increment)
--
-- Deliberately mirrors lib/commerce/stock-adjustment.ts::adjustVariantStockByDelta
-- bucket-for-bucket, so claiming and releasing are exact inverses and the
-- pricing_config buckets can never drift from products.stock.
--
-- Raises SQLSTATE 'GM001' when a claim cannot be satisfied. Because that is an
-- unhandled exception, every write this call already made is rolled back —
-- reservations are all-or-nothing, never partial.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_order_stock(p_items JSONB, p_reserve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       JSONB;
  v_agg        JSONB := '{}'::JSONB;
  v_key        TEXT;
  v_pid        UUID;
  v_size       TEXT;
  v_color      TEXT;
  v_qty        INTEGER;
  v_delta      INTEGER;
  v_name       TEXT;
  v_stock      INTEGER;
  v_cfg        JSONB;
  v_mode       TEXT;
  v_bucket     TEXT;
  v_vkey       TEXT;
  v_have       INTEGER;
  v_label      TEXT;
  v_touched    INTEGER := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'products_touched', 0);
  END IF;

  -- Aggregate duplicate (product, size, color) tuples first. Two separately
  -- affordable lines for the same variant must not both pass against one unit.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'product_id') IS NULL THEN
      CONTINUE;
    END IF;

    v_key := (v_item->>'product_id')
             || '|' || COALESCE(v_item->>'size', '')
             || '|' || COALESCE(v_item->>'color', '');

    v_agg := jsonb_set(
      v_agg,
      ARRAY[v_key],
      to_jsonb(COALESCE((v_agg->>v_key)::INTEGER, 0) + COALESCE((v_item->>'quantity')::INTEGER, 0)),
      true
    );
  END LOOP;

  IF v_agg = '{}'::JSONB THEN
    RETURN jsonb_build_object('ok', true, 'products_touched', 0);
  END IF;

  -- Lock every product row involved, in a deterministic order, before reading
  -- or writing any of them. Two concurrent checkouts for the last unit
  -- therefore serialise here instead of both passing their availability check.
  PERFORM 1
     FROM public.products
    WHERE id IN (
            SELECT DISTINCT split_part(t.k, '|', 1)::UUID
              FROM jsonb_object_keys(v_agg) AS t(k)
          )
    ORDER BY id
      FOR UPDATE;

  FOR v_key IN SELECT t.k FROM jsonb_object_keys(v_agg) AS t(k) ORDER BY t.k LOOP
    v_pid   := split_part(v_key, '|', 1)::UUID;
    v_size  := NULLIF(split_part(v_key, '|', 2), '');
    v_color := NULLIF(split_part(v_key, '|', 3), '');
    v_qty   := (v_agg->>v_key)::INTEGER;

    IF v_qty = 0 THEN
      CONTINUE;
    END IF;

    v_delta := CASE WHEN p_reserve THEN -v_qty ELSE v_qty END;

    -- Re-read inside the loop so several variants of one product accumulate
    -- against the running total rather than each seeing the original value.
    SELECT name, stock, pricing_config
      INTO v_name, v_stock, v_cfg
      FROM public.products
     WHERE id = v_pid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in this order no longer exists.' USING ERRCODE = 'GM001';
    END IF;

    -- Identify which pricing_config bucket holds this variant's stock, or none
    -- when the mode/selection can't identify one (matching the JS fallback,
    -- which then adjusts only the product total).
    v_bucket := NULL;
    v_vkey   := NULL;

    IF v_cfg IS NOT NULL THEN
      v_mode := COALESCE(v_cfg->>'mode', 'single');

      IF v_mode = 'single' AND v_cfg ? 'singleStock' THEN
        v_bucket := 'singleStock';
      ELSIF v_mode = 'size' AND v_size IS NOT NULL
            AND COALESCE(v_cfg->'sizeStock', '{}'::JSONB) ? v_size THEN
        v_bucket := 'sizeStock';
        v_vkey   := v_size;
      ELSIF v_mode = 'color' AND v_color IS NOT NULL
            AND COALESCE(v_cfg->'colorStock', '{}'::JSONB) ? v_color THEN
        v_bucket := 'colorStock';
        v_vkey   := v_color;
      ELSIF v_mode = 'combination' AND v_size IS NOT NULL AND v_color IS NOT NULL
            AND COALESCE(v_cfg->'combinationStock', '{}'::JSONB) ? (v_size || '|' || v_color) THEN
        v_bucket := 'combinationStock';
        v_vkey   := v_size || '|' || v_color;
      END IF;
    END IF;

    IF p_reserve THEN
      v_label := v_name
                 || COALESCE(' (' || NULLIF(CONCAT_WS(' / ', v_size, v_color), '') || ')', '');

      -- Per-variant availability, checked against the same number
      -- getVariantStock() shows the customer.
      IF v_bucket IS NOT NULL THEN
        v_have := CASE
                    WHEN v_vkey IS NULL THEN (v_cfg->>v_bucket)::INTEGER
                    ELSE (v_cfg->v_bucket->>v_vkey)::INTEGER
                  END;

        IF COALESCE(v_have, 0) < v_qty THEN
          RAISE EXCEPTION 'Only % left of %.', GREATEST(COALESCE(v_have, 0), 0), v_label
            USING ERRCODE = 'GM001';
        END IF;
      END IF;

      IF COALESCE(v_stock, 0) < v_qty THEN
        RAISE EXCEPTION 'Only % left of %.', GREATEST(COALESCE(v_stock, 0), 0), v_label
          USING ERRCODE = 'GM001';
      END IF;
    END IF;

    IF v_bucket IS NOT NULL THEN
      IF v_vkey IS NULL THEN
        v_cfg := jsonb_set(v_cfg, ARRAY[v_bucket],
                           to_jsonb((v_cfg->>v_bucket)::INTEGER + v_delta), true);
      ELSE
        v_cfg := jsonb_set(v_cfg, ARRAY[v_bucket, v_vkey],
                           to_jsonb((v_cfg->v_bucket->>v_vkey)::INTEGER + v_delta), true);
      END IF;
    END IF;

    UPDATE public.products
       SET stock = COALESCE(v_stock, 0) + v_delta,
           pricing_config = v_cfg
     WHERE id = v_pid;

    v_touched := v_touched + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'products_touched', v_touched);
END;
$$;

-- Inventory must only ever move through the service-role server paths. Without
-- this, anyone holding the public anon key could call the function directly.
REVOKE ALL ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN) TO service_role;
