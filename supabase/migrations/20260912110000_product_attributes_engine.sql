-- ============================================================================
-- The attribute engine -- size and colour become data, not schema
-- ----------------------------------------------------------------------------
-- product_variants has hardcoded exactly two axes since 20251101002600: `size`
-- and `color`, combined into `variant_key` (a GENERATED column) via
-- public.variant_key(size, color). Every function that touches a variant
-- (sync_variants_from_pricing_config, replace_product_variants,
-- adjust_order_stock, set_variant_stock, list_products, product_candidates,
-- product_facet_options, product_cards) is built around exactly those two
-- named columns. A store that wants to sell anything not describable as
-- size-and-colour -- a candle needing "Scent", a phone case needing "Model"
-- -- has no way to do that without another schema migration.
--
-- This makes the axis set data instead of schema, the same move already made
-- for price (pricing_config -> product_variants, 20251101002600) and for
-- money (integer Naira -> bigint minor units, 20260910130000): change the
-- model underneath, keep the surface every existing caller already speaks
-- working via a bridge, and leave the application-layer rewrite (admin UI,
-- storefront picker, discount targeting) as separate follow-up -- see
-- BACKLOG.md.
--
-- WHAT THIS DOES
--
--   1. product_attributes / product_attribute_values: a catalogue of variant
--      axes a store sells by, seeded with `size` and `color` as system
--      attributes so every existing product validates unchanged.
--   2. product_variants.attributes jsonb: the new source of truth for a
--      variant's axis values, e.g. {"size":"M","color":"Red"}.
--   3. product_variants.size / .color become real GENERATED ALWAYS AS STORED
--      columns, derived from attributes ->> 'size' / ->> 'color'. JSONB
--      extraction on the row's own column is IMMUTABLE with no subquery, so
--      this is legal -- and it is the literal technique 20251101002600 already
--      used for variant_key. Every existing SQL function, the RLS column-level
--      GRANT, and every TypeScript file that reads .size/.color (including
--      PUBLIC_VARIANT_COLUMNS in lib/commerce/product-variants.ts, which a
--      test asserts matches the GRANT byte-for-byte) needs ZERO changes.
--   4. product_variants.variant_key stops being a generated column and becomes
--      trigger-maintained instead. Composing a key from an arbitrary,
--      catalogue-ordered set of attributes needs a join against
--      product_attributes.sort_order, which is no longer a subquery-free
--      IMMUTABLE expression -- the same reason 20251101002800's README
--      explains products.search_vector is a trigger and not a generated
--      column: "A generated column needs an IMMUTABLE expression ... A BEFORE
--      trigger has no such limit." With only size/color present (sort_order
--      1/2, seeded below), the trigger reproduces the old size|color ordering
--      byte-for-byte for every existing row.
--   5. create_product_attribute(): the one thing an admin needs to call
--      before a variant can carry a new axis. Values auto-populate on first
--      use via a second trigger.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   No variant_attribute_values join table. product_variants.attributes is
--   already the per-variant source of truth and is GIN-indexed for
--   containment queries -- a join table recording the same assignment a
--   second time is one more thing that could disagree with it.
--   product_attribute_values holds only the *known* values (for a future
--   admin picker / consistent swatches), populated automatically on first use.
--
--   No anon/authenticated grant on either new table: nothing in the
--   storefront reads this catalogue yet. Deferred deliberately, like
--   20260911100000 deferred scoping the operational log tables, and named
--   here rather than left as a silent gap.
--
--   No TypeScript changes. The generated-column bridge in step 3 is
--   specifically what makes that true. The deeper application-layer rework
--   (admin variant editor, storefront N-axis picker, discount variant
--   targeting, cart line identity) is real follow-up work, tracked in
--   BACKLOG.md, not done here -- exactly how 20251101002600 left
--   pricing_config in place rather than rewriting every consumer in one pass.
--
-- Every new SECURITY DEFINER function is created already owned by
-- app_service, rather than left for a 20260912100000-style follow-up fix.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The attribute catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores (id),
  key         text NOT NULL,
  name        text NOT NULL,
  input_type  text NOT NULL DEFAULT 'select' CHECK (input_type IN ('select', 'swatch')),
  is_system   boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, key)
);

COMMENT ON TABLE public.product_attributes IS
  'The catalogue of variant axes a store sells by. size and colour are seeded below as system attributes; anything else an admin defines starts here via create_product_attribute().';

ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_service scoped by store" ON public.product_attributes;
CREATE POLICY "app_service scoped by store" ON public.product_attributes
  FOR ALL TO app_service
  USING (store_id = public.current_store_id())
  WITH CHECK (store_id = public.current_store_id());

-- No anon/authenticated grant -- see the header.
REVOKE ALL ON public.product_attributes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_product_attributes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_attributes_touch_updated_at ON public.product_attributes;
CREATE TRIGGER product_attributes_touch_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_attributes_updated_at();

CREATE TABLE IF NOT EXISTS public.product_attribute_values (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id  uuid NOT NULL REFERENCES public.product_attributes (id) ON DELETE CASCADE,
  value         text NOT NULL,
  swatch_hex    text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, value)
);

COMMENT ON TABLE public.product_attribute_values IS
  'Known values per attribute (e.g. every colour ever used), populated automatically the first time a variant uses one -- see product_variants_sync_attribute_catalog(). Not the per-variant assignment; that lives in product_variants.attributes.';

ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_service scoped by store via product_attributes" ON public.product_attribute_values;
CREATE POLICY "app_service scoped by store via product_attributes" ON public.product_attribute_values
  FOR ALL TO app_service
  USING (EXISTS (
    SELECT 1 FROM public.product_attributes a
     WHERE a.id = product_attribute_values.attribute_id AND a.store_id = public.current_store_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_attributes a
     WHERE a.id = product_attribute_values.attribute_id AND a.store_id = public.current_store_id()
  ));

REVOKE ALL ON public.product_attribute_values FROM anon, authenticated;

-- Seed size & colour as system attributes for every existing store, so every
-- existing product_variants row (all size/colour-only) validates against the
-- catalogue with zero data changes.
INSERT INTO public.product_attributes (store_id, key, name, input_type, is_system, sort_order)
SELECT s.id, v.key, v.name, v.input_type, true, v.sort_order
  FROM public.stores s
  CROSS JOIN (VALUES
    ('size',  'Size',   'select', 1),
    ('color', 'Colour', 'swatch', 2)
  ) AS v(key, name, input_type, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.product_attributes a WHERE a.store_id = s.id AND a.key = v.key
 );

-- ---------------------------------------------------------------------------
-- 2. product_variants.attributes -- the new source of truth
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS product_variants_attributes_gin_idx
  ON public.product_variants USING GIN (attributes);

COMMENT ON COLUMN public.product_variants.attributes IS
  'The source of truth for this variant''s axis values, e.g. {"size":"M","color":"Red"}. size, color and variant_key are all derived from this column -- see this migration''s header for why size/color stay generated and variant_key does not.';

-- ---------------------------------------------------------------------------
-- 3. variant_key stops being a generated column
-- ---------------------------------------------------------------------------
-- Keeps whatever is already stored (correct, unchanged) and turns the column
-- into a normal one a trigger can write to. Guarded so a second run, which
-- finds a plain column already, does not error trying to DROP EXPRESSION a
-- second time.
DO $convert_variant_key$
BEGIN
  IF (SELECT is_generated FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'variant_key') = 'ALWAYS' THEN
    ALTER TABLE public.product_variants ALTER COLUMN variant_key DROP EXPRESSION;
  END IF;
END $convert_variant_key$;

-- ---------------------------------------------------------------------------
-- 4. variant_key_from_attributes() -- the new addressing scheme
-- ---------------------------------------------------------------------------
-- Joins each present attribute key to its catalogue sort_order, so the key is
-- ordered the way the catalogue says the axes are ordered rather than by
-- insertion order or alphabet. With only size (1) and color (2) present, this
-- reproduces the old size|color ordering exactly.
CREATE OR REPLACE FUNCTION public.variant_key_from_attributes(p_attributes jsonb, p_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      string_agg(NULLIF(btrim(kv.value), ''), '|' ORDER BY a.sort_order, a.key),
      ''
    ),
    'single'
  )
  FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb)) AS kv(key, value)
  JOIN public.product_attributes a
    ON a.store_id = p_store_id AND a.key = kv.key
$$;

COMMENT ON FUNCTION public.variant_key_from_attributes(jsonb, uuid) IS
  'The generalised variant_key builder: joins each present attribute to its catalogue sort_order and pipe-joins the trimmed values in that order, falling back to ''single''. With only size/color present this is byte-identical to the old public.variant_key(size, color).';

-- ---------------------------------------------------------------------------
-- 5. product_variants_set_key() -- catalogue-first validation + the key
-- ---------------------------------------------------------------------------
-- BEFORE, not AFTER: variant_key has to be correct before the row's own
-- INSERT/UPDATE is checked against the unique index on (product_id,
-- variant_key). Refuses an attribute key with no catalogue row for this
-- variant's store -- an admin (or a future admin route) must call
-- create_product_attribute() before a variant can carry a new axis.
CREATE OR REPLACE FUNCTION public.product_variants_set_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_missing  text;
BEGIN
  SELECT p.store_id INTO v_store_id
    FROM public.products p
   WHERE p.id = NEW.product_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'product_variants.product_id must reference an existing product.' USING ERRCODE = 'GM003';
  END IF;

  SELECT kv.key INTO v_missing
    FROM jsonb_each_text(COALESCE(NEW.attributes, '{}'::jsonb)) AS kv(key, value)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.product_attributes a
      WHERE a.store_id = v_store_id AND a.key = kv.key
   )
   LIMIT 1;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown product attribute "%" -- create it with create_product_attribute() first.', v_missing
      USING ERRCODE = 'GM003';
  END IF;

  NEW.variant_key := public.variant_key_from_attributes(NEW.attributes, v_store_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_set_key_trg ON public.product_variants;
CREATE TRIGGER product_variants_set_key_trg
  BEFORE INSERT OR UPDATE OF attributes ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_set_key();

-- ---------------------------------------------------------------------------
-- 6. product_variants_sync_attribute_catalog() -- the "known values" list
-- ---------------------------------------------------------------------------
-- AFTER, because it only needs to record what happened, not gate it. Every
-- (attribute, value) pair actually used gets a product_attribute_values row
-- the first time it appears, so the catalogue is always populated without a
-- separate backfill step.
CREATE OR REPLACE FUNCTION public.product_variants_sync_attribute_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT p.store_id INTO v_store_id FROM public.products p WHERE p.id = NEW.product_id;

  INSERT INTO public.product_attribute_values (attribute_id, value, sort_order)
  SELECT a.id,
         btrim(kv.value),
         COALESCE((SELECT max(pav.sort_order) + 1 FROM public.product_attribute_values pav WHERE pav.attribute_id = a.id), 0)
    FROM jsonb_each_text(COALESCE(NEW.attributes, '{}'::jsonb)) AS kv(key, value)
    JOIN public.product_attributes a ON a.store_id = v_store_id AND a.key = kv.key
   WHERE NULLIF(btrim(kv.value), '') IS NOT NULL
  ON CONFLICT (attribute_id, value) DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_sync_attribute_catalog_trg ON public.product_variants;
CREATE TRIGGER product_variants_sync_attribute_catalog_trg
  AFTER INSERT OR UPDATE OF attributes ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_sync_attribute_catalog();

-- ---------------------------------------------------------------------------
-- 7. size / color become generated, behind one backfill
-- ---------------------------------------------------------------------------
-- Postgres has no ALTER COLUMN ... ADD GENERATED for an existing plain
-- column, so this drops and re-adds size/color. Guarded on whether size is
-- already generated, so a second run is a no-op. The backfill UPDATE runs
-- first, while size/color are still the plain source columns, and fires the
-- two triggers above on every existing row -- populating attributes,
-- re-confirming variant_key (already correct, so a no-op change), and
-- populating product_attribute_values, all from one statement.
DO $convert_size_color$
BEGIN
  IF (SELECT is_generated FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'size') IS DISTINCT FROM 'ALWAYS' THEN

    UPDATE public.product_variants
       SET attributes = jsonb_strip_nulls(jsonb_build_object('size', size, 'color', color))
     WHERE attributes = '{}'::jsonb;

    DROP INDEX IF EXISTS public.product_variants_size_idx;
    DROP INDEX IF EXISTS public.product_variants_color_idx;

    ALTER TABLE public.product_variants DROP COLUMN size;
    ALTER TABLE public.product_variants DROP COLUMN color;

    ALTER TABLE public.product_variants
      ADD COLUMN size  text GENERATED ALWAYS AS (attributes ->> 'size')  STORED,
      ADD COLUMN color text GENERATED ALWAYS AS (attributes ->> 'color') STORED;

    CREATE INDEX product_variants_size_idx
      ON public.product_variants (size) WHERE size IS NOT NULL;

    CREATE INDEX product_variants_color_idx
      ON public.product_variants (color) WHERE color IS NOT NULL;

    -- Dropping a column drops grants naming it -- reissue the same grant
    -- 20251101002600 made, verbatim (PUBLIC_VARIANT_COLUMNS in
    -- lib/commerce/product-variants.ts asserts this list byte-for-byte).
    GRANT SELECT (id, product_id, size, color, variant_key, price, stock, image_url, is_active)
      ON public.product_variants TO anon, authenticated;
  END IF;
END $convert_size_color$;

-- ---------------------------------------------------------------------------
-- 8. sync_variants_from_pricing_config() -- writes attributes, not columns
-- ---------------------------------------------------------------------------
-- Verbatim from 20260910130000 except the INSERT target and the ON CONFLICT
-- SET clause. Stays a legacy two-axis importer by nature: pricing_config
-- itself has no notion of a third axis. Signature and return type unchanged.
CREATE OR REPLACE FUNCTION public.sync_variants_from_pricing_config(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg      JSONB;
  v_price    BIGINT;
  v_stock    INTEGER;
  v_active   BOOLEAN;
  v_mode     TEXT;
  v_keys     TEXT[];
  v_count    INTEGER;
BEGIN
  SELECT pricing_config, COALESCE(price, 0), COALESCE(stock, 0), COALESCE(is_active, true)
    INTO v_cfg, v_price, v_stock, v_active
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  v_mode := COALESCE(v_cfg->>'mode', 'single');

  WITH desired AS (
    -- single, and any product with no pricing_config at all
    SELECT NULLIF(btrim(COALESCE(v_cfg->>'singleSize', '')), '')  AS size,
           NULLIF(btrim(COALESCE(v_cfg->>'singleColor', '')), '') AS color,
           v_price AS price,
           GREATEST(COALESCE((v_cfg->>'singleStock')::INTEGER, v_stock, 0), 0) AS stock,
           v_cfg->'colorImages'->>COALESCE(v_cfg->>'singleColor', '') AS image_url
     WHERE v_mode = 'single'

    UNION ALL

    -- combination: keys look like "1-2 months|red"
    SELECT NULLIF(split_part(k.key, '|', 1), ''),
           NULLIF(split_part(k.key, '|', 2), ''),
           COALESCE((v_cfg->'combinationPrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'combinationStock'->>k.key)::INTEGER, 0), 0),
           v_cfg->'colorImages'->>split_part(k.key, '|', 2)
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'combinationPrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'combinationStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'combination' AND NULLIF(btrim(k.key), '') IS NOT NULL

    UNION ALL

    -- size only
    SELECT k.key, NULL,
           COALESCE((v_cfg->'sizePrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'sizeStock'->>k.key)::INTEGER, 0), 0),
           NULL
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'sizePrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'sizeStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'size' AND NULLIF(btrim(k.key), '') IS NOT NULL

    UNION ALL

    -- color only
    SELECT NULL, k.key,
           COALESCE((v_cfg->'colorPrices'->>k.key)::BIGINT, v_price),
           GREATEST(COALESCE((v_cfg->'colorStock'->>k.key)::INTEGER, 0), 0),
           v_cfg->'colorImages'->>k.key
      FROM (
        SELECT DISTINCT key FROM (
          SELECT jsonb_object_keys(COALESCE(v_cfg->'colorPrices', '{}'::JSONB)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(v_cfg->'colorStock',  '{}'::JSONB)) AS key
        ) AS both_maps
      ) AS k
     WHERE v_mode = 'color' AND NULLIF(btrim(k.key), '') IS NOT NULL
  ), upserted AS (
    INSERT INTO public.product_variants (product_id, attributes, price, stock, image_url, is_active)
    SELECT p_product_id,
           jsonb_strip_nulls(jsonb_build_object('size', d.size, 'color', d.color)),
           d.price, d.stock, d.image_url, v_active
      FROM desired d
    ON CONFLICT (product_id, variant_key) DO UPDATE
      -- price/stock/image/attributes follow the config. sku, barcode and cost
      -- are NOT touched: nothing in the pricing_config model can express
      -- them, so a save from the old form must not wipe values entered
      -- elsewhere.
      SET attributes = EXCLUDED.attributes,
          price      = EXCLUDED.price,
          stock      = EXCLUDED.stock,
          image_url  = COALESCE(EXCLUDED.image_url, public.product_variants.image_url),
          is_active  = EXCLUDED.is_active,
          updated_at = now()
    RETURNING variant_key
  )
  SELECT array_agg(variant_key) INTO v_keys FROM upserted;

  v_keys := COALESCE(v_keys, ARRAY[]::TEXT[]);

  -- Variants the admin removed from the config. Guarded so a config that
  -- produced nothing at all (a malformed save) cannot wipe a product's stock.
  IF array_length(v_keys, 1) > 0 THEN
    DELETE FROM public.product_variants
     WHERE product_id = p_product_id
       AND NOT (variant_key = ANY (v_keys));
  END IF;

  SELECT count(*) INTO v_count FROM public.product_variants WHERE product_id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variants', v_count);
END;
$$;

COMMENT ON FUNCTION public.sync_variants_from_pricing_config(uuid) IS
  'Derives product_variants rows from a product pricing_config, writing the resolved size/color into the attributes column. Called by the migration backfill and by the admin product save. Price values are bigint minor units (20260910130000).';

-- ---------------------------------------------------------------------------
-- 9. replace_product_variants() -- the real generic write path
-- ---------------------------------------------------------------------------
-- Unreferenced by any application code today (true as of 20260910130000), so
-- this is the right place to become the actual attribute-engine write path:
-- an incoming item may carry an explicit "attributes" object
-- ({"size":"M","material":"Cotton"}), or fall back to today's flat
-- size/color keys, resolved once per item into the same shape either way.
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
      SET attributes = EXCLUDED.attributes,
          price      = EXCLUDED.price,
          stock      = EXCLUDED.stock,
          sku        = EXCLUDED.sku,
          barcode    = EXCLUDED.barcode,
          image_url  = EXCLUDED.image_url,
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

COMMENT ON FUNCTION public.replace_product_variants(uuid, jsonb) IS
  'Bulk-replaces a product''s variant rows from an explicit array. Each item may carry an "attributes" object directly ({"size":"M","material":"Cotton"}), or flat size/color keys for backward compatibility. Price/cost values are bigint minor units (20260910130000).';

-- ---------------------------------------------------------------------------
-- 10. create_product_attribute() -- the one admin entry point
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_product_attribute(
  p_key         text,
  p_name        text,
  p_input_type  text DEFAULT 'select'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id   uuid := public.current_store_id();
  v_id         uuid;
  v_next_order integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Attribute key must be a lowercase slug (letters, digits, underscore), starting with a letter.'
      USING ERRCODE = 'GM003';
  END IF;

  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Attribute name is required.' USING ERRCODE = 'GM003';
  END IF;

  IF p_input_type NOT IN ('select', 'swatch') THEN
    RAISE EXCEPTION 'Attribute input type must be "select" or "swatch".' USING ERRCODE = 'GM003';
  END IF;

  IF EXISTS (SELECT 1 FROM public.product_attributes WHERE store_id = v_store_id AND key = p_key) THEN
    RAISE EXCEPTION 'An attribute with key "%" already exists.', p_key USING ERRCODE = 'GM003';
  END IF;

  SELECT COALESCE(max(sort_order) + 1, 1) INTO v_next_order
    FROM public.product_attributes WHERE store_id = v_store_id;

  INSERT INTO public.product_attributes (store_id, key, name, input_type, sort_order)
  VALUES (v_store_id, p_key, btrim(p_name), p_input_type, v_next_order)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_attribute(text, text, text) IS
  'Declares a new variant axis for the current store (e.g. "material"/"Material"). Must be called before any variant can carry that key in product_variants.attributes -- see product_variants_set_key().';

-- ---------------------------------------------------------------------------
-- 11. Ownership -- app_service from creation, not a later fix
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.variant_key_from_attributes(jsonb, uuid) OWNER TO app_service;
ALTER FUNCTION public.product_variants_set_key() OWNER TO app_service;
ALTER FUNCTION public.product_variants_sync_attribute_catalog() OWNER TO app_service;
ALTER FUNCTION public.create_product_attribute(text, text, text) OWNER TO app_service;
ALTER FUNCTION public.sync_variants_from_pricing_config(uuid) OWNER TO app_service;
ALTER FUNCTION public.replace_product_variants(uuid, jsonb) OWNER TO app_service;
