-- ============================================================================
-- Atomic stock editing for the admin Stock page
-- ----------------------------------------------------------------------------
-- The last read-modify-write on products.stock / pricing_config. The route did:
--
--     SELECT stock, pricing_config  ->  compute in JS  ->  UPDATE
--
-- with no lock and no version check. Two ways that loses data:
--
--   1. Two admins editing DIFFERENT variants of the same product at the same
--      time. Each rewrites the whole pricing_config blob from the copy it read,
--      so the second save silently discards the first.
--   2. An admin saving stock while an order is confirmed or cancelled. One of
--      the two adjustments disappears. This is the drift that
--      20251101001400_reconcile_drifted_product_stock exists to repair.
--
-- adjust_order_stock() already fixed the order side. This does the admin side,
-- under the same SELECT ... FOR UPDATE row lock, so the two now serialise
-- against each other instead of overwriting.
--
-- ONE DELIBERATE BEHAVIOUR CHANGE: for a product with variant buckets, the
-- product total is now recomputed as the SUM OF ALL BUCKETS rather than by
-- delta arithmetic (old_total - old_bucket + new_bucket). Both give the same
-- answer when the data is consistent — but the delta form faithfully preserves
-- any existing drift, whereas summing corrects it. The admin Stock page is now
-- self-healing: editing any variant of a drifted product fixes that product.
--
-- Raises SQLSTATE 'GM003' for a negative input, so the caller gets a clear
-- message rather than the prevent_negative_stock trigger's lower-level one.
--
-- Safe to run more than once.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_variant_stock(
  p_product_id  UUID,
  p_variant_key TEXT,
  p_new_stock   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock   INTEGER;
  v_cfg     JSONB;
  v_mode    TEXT;
  v_bucket  TEXT;
  v_total   INTEGER;
BEGIN
  IF p_product_id IS NULL OR p_variant_key IS NULL OR p_variant_key = '' THEN
    RAISE EXCEPTION 'set_variant_stock requires a product id and a variant key' USING ERRCODE = 'GM003';
  END IF;

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative.' USING ERRCODE = 'GM003';
  END IF;

  -- The lock. Everything below reads and writes the row while holding it, so a
  -- concurrent order confirmation or a second admin save waits here rather than
  -- computing from a stale copy.
  SELECT stock, pricing_config
    INTO v_stock, v_cfg
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  v_mode := COALESCE(v_cfg->>'mode', 'single');

  -- 'single' as the variant key means "the product as a whole", regardless of
  -- what mode the config claims — matching the previous JS behaviour.
  IF p_variant_key = 'single' OR v_mode = 'single' OR v_cfg IS NULL THEN
    v_cfg   := jsonb_set(COALESCE(v_cfg, '{"mode":"single"}'::JSONB), '{singleStock}', to_jsonb(p_new_stock), true);
    v_total := p_new_stock;
  ELSE
    v_bucket := CASE v_mode
                  WHEN 'combination' THEN 'combinationStock'
                  WHEN 'size'        THEN 'sizeStock'
                  WHEN 'color'       THEN 'colorStock'
                END;

    IF v_bucket IS NULL THEN
      RAISE EXCEPTION 'Unknown pricing mode "%" on this product.', v_mode USING ERRCODE = 'GM003';
    END IF;

    -- Creates the bucket key if it wasn't there (a variant added since the
    -- config was written), matching the old "treat a missing bucket as 0".
    v_cfg := jsonb_set(
      COALESCE(v_cfg, '{}'::JSONB),
      ARRAY[v_bucket, p_variant_key],
      to_jsonb(p_new_stock),
      true
    );

    -- Sum of every bucket, not delta arithmetic — see the header note.
    SELECT COALESCE(SUM(value::INTEGER), 0)
      INTO v_total
      FROM jsonb_each_text(v_cfg->v_bucket);
  END IF;

  UPDATE public.products
     SET stock = v_total,
         pricing_config = v_cfg,
         updated_at = NOW()
   WHERE id = p_product_id;

  RETURN jsonb_build_object('stock', v_total, 'pricing_config', v_cfg);
END;
$$;

REVOKE ALL ON FUNCTION public.set_variant_stock(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_variant_stock(UUID, TEXT, INTEGER) TO service_role;
