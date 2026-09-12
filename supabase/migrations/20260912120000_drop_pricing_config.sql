-- ============================================================================
-- Finish killing pricing_config -- one source of truth for price and stock
-- ----------------------------------------------------------------------------
-- 20251101002600 moved variant price/stock into product_variants but
-- deliberately left products.pricing_config in place: it still fed the admin
-- form and was still the fallback for a product whose variant rows were
-- missing, with a note that "removing the now-dead price and stock maps is a
-- later, separate migration." This is that migration.
--
-- The application layer (shipped alongside this migration) now writes
-- variants directly via replace_product_variants() -- added, but never wired
-- up, in 20260912110000 -- instead of writing pricing_config and having
-- sync_variants_from_pricing_config() derive rows from it.
--
-- WHAT THIS DOES
--
--   1. Backfills any product that still has zero product_variants rows, using
--      sync_variants_from_pricing_config() one last time while it still
--      exists -- the correct derivation to reuse rather than reimplementing
--      pricing_config's single/size/color/combination/colorImages branching a
--      second time in a one-off script.
--   2. Fixes a real bug in replace_product_variants() before it becomes the
--      live write path: its upsert did a plain, unconditional SET for every
--      column, including sku/barcode/image_url. The admin form has no UI for
--      sku/barcode and only sometimes sends image_url (only for a color whose
--      photo is currently assigned), so as written it would silently null
--      those out on every ordinary save. sync_variants_from_pricing_config
--      protected exactly these three columns with
--      COALESCE(EXCLUDED.x, product_variants.x); replace_product_variants
--      gets the same protection. price/stock/cost/is_active/attributes stay
--      plain overwrites -- the form always sends a real value for those.
--   3. Drops sync_variants_from_pricing_config() -- nothing calls it once the
--      application layer ships -- and products.pricing_config itself.
--
-- Ordering: application code that stops reading/writing pricing_config and
-- switches to replace_product_variants() ships BEFORE this migration runs.
-- Running this migration first would 500 every product save and the admin
-- products list for however long the rollout window was.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill stragglers, using the function we're about to retire.
-- ----------------------------------------------------------------------------
DO $backfill$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT p.id
      FROM public.products p
     WHERE NOT EXISTS (
       SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id
     )
  LOOP
    PERFORM public.sync_variants_from_pricing_config(v_id);
  END LOOP;
END;
$backfill$;

-- ----------------------------------------------------------------------------
-- 2. Fix replace_product_variants(): protect sku/barcode/image_url on update,
--    the same way sync_variants_from_pricing_config always did.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_product_variants(
  p_product_id UUID,
  p_variants   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_keys TEXT[];
  v_kept INTEGER;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'replace_product_variants requires a product id' USING ERRCODE = 'GM003';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'replace_product_variants requires an array of variants' USING ERRCODE = 'GM003';
  END IF;

  -- An empty array would fall through to the DELETE below and remove every
  -- variant, zeroing the product's stock. No legitimate save wants that, and a
  -- form bug that submitted nothing would silently wipe inventory, so refuse
  -- it rather than obey it.
  IF jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'A product must keep at least one variant.' USING ERRCODE = 'GM003';
  END IF;

  SELECT store_id INTO v_store_id FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  WITH incoming AS (
    SELECT
      COALESCE(
        i->'attributes',
        jsonb_strip_nulls(jsonb_build_object(
          'size',  NULLIF(btrim(COALESCE(i->>'size',  '')), ''),
          'color', NULLIF(btrim(COALESCE(i->>'color', '')), '')
        ))
      ) AS attributes,
      GREATEST(COALESCE((i->>'price')::BIGINT, 0), 0)  AS price,
      GREATEST(COALESCE((i->>'stock')::INTEGER, 0), 0)  AS stock,
      NULLIF(btrim(COALESCE(i->>'sku',       '')), '') AS sku,
      NULLIF(btrim(COALESCE(i->>'barcode',   '')), '') AS barcode,
      NULLIF(btrim(COALESCE(i->>'image_url', '')), '') AS image_url,
      CASE WHEN (i->>'cost') IS NULL THEN NULL
           ELSE GREATEST((i->>'cost')::BIGINT, 0) END AS cost,
      COALESCE((i->>'is_active')::BOOLEAN, true)        AS is_active,
      i.ordinality
    FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS i(value, ordinality)
  ), deduped AS (
    -- Two rows for one combination would violate the unique index. Keep the
    -- last, matching how a later entry in the form wins -- which needs the
    -- explicit ordinality below, because DISTINCT ON without a tiebreaker
    -- keeps an arbitrary row rather than a predictable one.
    SELECT DISTINCT ON (public.variant_key_from_attributes(attributes, v_store_id))
           attributes, price, stock, sku, barcode, image_url, cost, is_active
      FROM incoming
     ORDER BY public.variant_key_from_attributes(attributes, v_store_id), ordinality DESC
  ), upserted AS (
    INSERT INTO public.product_variants
      (product_id, attributes, price, stock, sku, barcode, image_url, cost, is_active)
    SELECT p_product_id, attributes, price, stock, sku, barcode, image_url, cost, is_active
      FROM deduped
    ON CONFLICT (product_id, variant_key) DO UPDATE
      -- sku/barcode/image_url are NOT unconditionally overwritten: nothing in
      -- the admin form can express sku/barcode at all, and image_url is only
      -- sent for a color whose photo is currently assigned in the form, not
      -- for every color on every save. An unconditional SET here would wipe
      -- values entered elsewhere (a CSV import, a barcode scan, a photo that
      -- was uploaded once and never re-touched) on the very next ordinary
      -- product save.
      SET attributes = EXCLUDED.attributes,
          price      = EXCLUDED.price,
          stock      = EXCLUDED.stock,
          sku        = COALESCE(EXCLUDED.sku, public.product_variants.sku),
          barcode    = COALESCE(EXCLUDED.barcode, public.product_variants.barcode),
          image_url  = COALESCE(EXCLUDED.image_url, public.product_variants.image_url),
          cost       = EXCLUDED.cost,
          is_active  = EXCLUDED.is_active
    RETURNING variant_key
  )
  SELECT array_agg(variant_key) INTO v_keys FROM upserted;

  v_keys := COALESCE(v_keys, ARRAY[]::TEXT[]);

  -- Guarded for the same reason as the length check above: `NOT (x = ANY('{}'))`
  -- is true for every row, so an empty key set here would delete them all.
  IF array_length(v_keys, 1) > 0 THEN
    DELETE FROM public.product_variants
     WHERE product_id = p_product_id
       AND NOT (variant_key = ANY (v_keys));
  END IF;

  SELECT count(*) INTO v_kept FROM public.product_variants WHERE product_id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variants', v_kept);
END;
$$;

ALTER FUNCTION public.replace_product_variants(uuid, jsonb) OWNER TO app_service;

COMMENT ON FUNCTION public.replace_product_variants(uuid, jsonb) IS
  'Bulk-replaces a product''s variant rows from an explicit array -- the sole write path now that pricing_config is gone. Each item may carry an "attributes" object directly ({"size":"M","material":"Cotton"}), or flat size/color keys for backward compatibility. Price/cost values are bigint minor units (20260910130000). sku/barcode/image_url are preserved when an item omits them (20260912120000).';

-- ----------------------------------------------------------------------------
-- 3. Drop the superseded function and the column it read.
-- ----------------------------------------------------------------------------
DROP FUNCTION public.sync_variants_from_pricing_config(uuid);

ALTER TABLE public.products DROP COLUMN pricing_config;
