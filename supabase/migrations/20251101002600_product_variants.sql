-- ============================================================================
-- product_variants: one row per sellable combination
-- ----------------------------------------------------------------------------
-- Until now a variant existed only inside products.pricing_config, as parallel
-- JSONB maps keyed by a "size|color" string:
--
--   {"mode":"combination",
--    "combinationPrices":{"1-2 months|red":13000, ...},
--    "combinationStock" :{"1-2 months|red":4, ...},
--    "colorImages"      :{"red":"https://..."}}
--
-- with products.stock as a hand-maintained total. That model is the direct
-- cause of two bugs already fixed in this folder: the admin stock write race
-- (20251101002400) and total-vs-bucket drift (20251101001600). Both are
-- inherent to it — adjusting one variant's stock means reading, editing and
-- rewriting an entire document, and nothing but application code keeps the
-- total honest.
--
-- It also makes several things impossible rather than merely awkward: there is
-- nowhere to put a SKU, a barcode, or a unit cost; no index can answer "which
-- products come in red" so faceted search cannot be built; and order_items
-- cannot point at what was actually sold, so there is no variant-level
-- reporting.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Creates product_variants, one row per sellable combination.
--   2. Backfills it from pricing_config, covering all four modes.
--   3. Makes products.stock a trigger-maintained SUM of its variants, so the
--      total can no longer drift from its parts.
--   4. Rewrites adjust_order_stock and set_variant_stock to lock and update
--      variant rows instead of rewriting a JSON document.
--   5. Adds order_items.variant_id and backfills it.
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
--   pricing_config is left in place. Dropping it now would break the storefront
--   gallery (colorImages) and the admin product form in the same change that
--   moves the stock model, and would leave no fallback for a product whose
--   variant rows are missing. It stops being the source of truth for stock and
--   price; removing the dead maps is a later, separate migration.
--
-- variant_key is retained as a generated column because it is the addressing
-- scheme the whole application already uses — the admin stock page, discount
-- variant targeting, and cart lines all speak it. Keeping it means the read
-- interface (flattenProducts) can be re-pointed at this table without every
-- caller changing.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. The one definition of a variant key
-- ---------------------------------------------------------------------------
-- A function rather than an inline expression for two reasons.
--
-- The first is that it has to be IMMUTABLE. The generated column below started
-- life as COALESCE(NULLIF(concat_ws('|', size, color), ''), 'single') and
-- Postgres refused it: "generation expression is not immutable" (42P17).
-- concat_ws is only STABLE, because it takes "any" arguments and calls their
-- type output functions, which can depend on settings. Plain `||` on text,
-- btrim, NULLIF and CASE are all immutable, so this builds the key from those.
--
-- The second is that the key was being derived in five places — the generated
-- column, the order_items backfill, adjust_order_stock, and twice inside
-- replace_product_variants — with subtly different handling of blanks. Any
-- disagreement between them means a lookup silently matches nothing and the
-- application falls back to stale numbers. Now there is one definition.
--
-- Blank and NULL are treated the same, matching variantKeyFor() in
-- lib/commerce/product-variants.ts, so ' ' never becomes a second identity.
--
-- NOTE: a generated column depends on this function, so its signature cannot
-- be changed without dropping the column. CREATE OR REPLACE of the body is
-- allowed but would NOT recompute already-stored keys.
CREATE OR REPLACE FUNCTION public.variant_key(p_size text, p_color text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_size, '')), '') IS NOT NULL
     AND NULLIF(btrim(COALESCE(p_color, '')), '') IS NOT NULL
      THEN btrim(p_size) || '|' || btrim(p_color)
    WHEN NULLIF(btrim(COALESCE(p_size, '')), '') IS NOT NULL
      THEN btrim(p_size)
    WHEN NULLIF(btrim(COALESCE(p_color, '')), '') IS NOT NULL
      THEN btrim(p_color)
    ELSE 'single'
  END
$$;

COMMENT ON FUNCTION public.variant_key(text, text) IS
  'The single definition of a variant addressing key. Mirrored by variantKeyFor() in lib/commerce/product-variants.ts; a test asserts they agree.';

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  -- NULL where the axis does not apply: a size-only product has no color, and
  -- a product with no variants at all has neither.
  size text,
  color text,

  /**
   * The key the application already addresses variants by: 'single' when
   * neither axis applies, the size or the colour alone when only one does, and
   * 'size|color' when both. See section 0 for why this is a function call.
   */
  variant_key text GENERATED ALWAYS AS (public.variant_key(size, color)) STORED,

  sku text,
  barcode text,

  -- integer, matching products.price: this store prices in whole naira and the
  -- whole application treats money as an integer.
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  /** What the unit costs the store, for margin reporting. Nothing sets it yet. */
  cost integer CHECK (cost IS NULL OR cost >= 0),

  -- The CHECK is the point of the exercise: stock can no longer be driven
  -- negative by arithmetic on a JSON document.
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),

  /** Per-variant image. Backfilled from pricing_config.colorImages. */
  image_url text,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per sellable combination. On variant_key rather than (size, color)
-- because Postgres treats NULLs as distinct in a unique index by default,
-- which would allow two (product, NULL, NULL) rows.
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_key_idx
  ON public.product_variants (product_id, variant_key);

-- A SKU identifies one variant across the whole catalogue.
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_idx
  ON public.product_variants (sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode_idx
  ON public.product_variants (barcode)
  WHERE barcode IS NOT NULL;

-- The indexes faceted search needs, and which a JSONB blob could not provide.
CREATE INDEX IF NOT EXISTS product_variants_size_idx
  ON public.product_variants (size) WHERE size IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_variants_color_idx
  ON public.product_variants (color) WHERE color IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_variants_in_stock_idx
  ON public.product_variants (product_id) WHERE is_active AND stock > 0;

COMMENT ON TABLE public.product_variants IS
  'One row per sellable size/color combination. Source of truth for variant price and stock; products.stock is a trigger-maintained sum of these rows.';

-- ---------------------------------------------------------------------------
-- 2. Deriving variants from pricing_config
-- ---------------------------------------------------------------------------
-- This is a function rather than a one-off backfill script on purpose.
--
-- The admin product form still submits a pricing_config, so something has to
-- turn that into variant rows on every save, not just once at migration time.
-- Writing that logic twice — SQL for the backfill, TypeScript for the form —
-- would be two implementations of one rule, which is exactly the drift trap
-- this project already hit with the phone normaliser. One SQL function serves
-- both: the backfill below calls it for every product, and
-- app/api/admin/products/route.ts calls it after each save.
--
-- The key set per mode is the UNION of that mode's price and stock maps, so a
-- variant present in only one of them is carried over rather than silently
-- dropped.
CREATE OR REPLACE FUNCTION public.sync_variants_from_pricing_config(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg      JSONB;
  v_price    INTEGER;
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
           COALESCE((v_cfg->'combinationPrices'->>k.key)::INTEGER, v_price),
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
           COALESCE((v_cfg->'sizePrices'->>k.key)::INTEGER, v_price),
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
           COALESCE((v_cfg->'colorPrices'->>k.key)::INTEGER, v_price),
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
    INSERT INTO public.product_variants (product_id, size, color, price, stock, image_url, is_active)
    SELECT p_product_id, d.size, d.color, d.price, d.stock, d.image_url, v_active
      FROM desired d
    ON CONFLICT (product_id, variant_key) DO UPDATE
      -- price/stock/image follow the config. sku, barcode and cost are NOT
      -- touched: nothing in the pricing_config model can express them, so a
      -- save from the old form must not wipe values entered elsewhere.
      SET price      = EXCLUDED.price,
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
  'Derives product_variants rows from a product pricing_config. Called by the migration backfill and by the admin product save, so the rule has one implementation.';

-- The backfill itself: every product, through the same function the
-- application will use from now on.
SELECT public.sync_variants_from_pricing_config(id) FROM public.products;

-- ---------------------------------------------------------------------------
-- 3. products.stock becomes derived, and cannot drift
-- ---------------------------------------------------------------------------
-- The column stays: the storefront and every product list read a single total,
-- and computing it per query would be wasteful. What changes is that nothing
-- writes it by hand any more.
CREATE OR REPLACE FUNCTION public.sync_product_stock_total(p_product_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products p
     SET stock = COALESCE((
           SELECT SUM(v.stock) FROM public.product_variants v WHERE v.product_id = p.id
         ), 0)
   WHERE p.id = p_product_id;
$$;

CREATE OR REPLACE FUNCTION public.product_variants_sync_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On UPDATE the product can change, so both sides need recomputing.
  IF TG_OP <> 'INSERT' AND OLD.product_id IS NOT NULL THEN
    PERFORM public.sync_product_stock_total(OLD.product_id);
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.product_id IS NOT NULL THEN
    PERFORM public.sync_product_stock_total(NEW.product_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_sync_total_trg ON public.product_variants;
CREATE TRIGGER product_variants_sync_total_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_sync_total();

CREATE OR REPLACE FUNCTION public.touch_product_variants_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_touch_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_touch_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_variants_updated_at();

-- Bring every total in line with the rows just inserted. From here the trigger
-- keeps them so.
SELECT public.sync_product_stock_total(id) FROM public.products;

-- ---------------------------------------------------------------------------
-- 4. order_items points at what was actually sold
-- ---------------------------------------------------------------------------
-- Nullable and ON DELETE SET NULL: an order's line items are an immutable
-- record, so retiring a variant must never delete or block sales history.
-- product_name / size / color / price on the row remain the snapshot.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid
  REFERENCES public.product_variants (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_items_variant_id_idx
  ON public.order_items (variant_id) WHERE variant_id IS NOT NULL;

UPDATE public.order_items oi
   SET variant_id = v.id
  FROM public.product_variants v
 WHERE v.product_id = oi.product_id
   AND v.variant_key = public.variant_key(oi.size, oi.color)
   AND oi.variant_id IS DISTINCT FROM v.id;

-- ---------------------------------------------------------------------------
-- 5. Stock arithmetic moves onto the rows
-- ---------------------------------------------------------------------------
-- Replaces the JSONB read-modify-write. A variant's stock is now one UPDATE on
-- one locked row, so two concurrent checkouts for the last unit serialise on
-- that row rather than racing to rewrite the same document.
CREATE OR REPLACE FUNCTION public.adjust_order_stock(p_items JSONB, p_reserve BOOLEAN)
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

  -- Aggregate duplicate (product, size, color) tuples first, so two separately
  -- affordable lines for one variant cannot both pass against a single unit.
  FOR v_row IN
    SELECT (i->>'product_id')::UUID AS product_id,
           public.variant_key(i->>'size', i->>'color') AS variant_key,
           SUM(COALESCE((i->>'quantity')::INTEGER, 0)) AS qty
      FROM jsonb_array_elements(p_items) AS i
     WHERE (i->>'product_id') IS NOT NULL
     GROUP BY 1, 2
     -- Deterministic order, so concurrent multi-item orders cannot deadlock by
     -- taking the same two rows in opposite orders.
     ORDER BY 1, 2
  LOOP
    IF v_row.qty = 0 THEN
      CONTINUE;
    END IF;

    v_delta := CASE WHEN p_reserve THEN -v_row.qty ELSE v_row.qty END;

    -- The lock. One row, held for the read and the write. FOR UPDATE OF v
    -- locks the variant row only — the joined product row is read, not locked.
    SELECT v.id, v.stock, p.name, v.size, v.color
      INTO v_vid, v_have, v_name, v_size, v_color
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.product_id = v_row.product_id
       AND v.variant_key = v_row.variant_key
       FOR UPDATE OF v;

    -- FOUND, not `v_vid IS NULL`: the variables keep their values from the
    -- previous iteration when a SELECT INTO matches nothing.
    IF NOT FOUND THEN
      -- Under the old model an unrecognised selection quietly adjusted only the
      -- product total, which is what allowed a sale of something not for sale.
      -- Refuse it instead.
      RAISE EXCEPTION 'That item is no longer available in the selected size or colour.'
        USING ERRCODE = 'GM001';
    END IF;

    v_label := v_name || COALESCE(' (' || NULLIF(concat_ws(' / ', v_size, v_color), '') || ')', '');

    IF p_reserve AND COALESCE(v_have, 0) < v_row.qty THEN
      RAISE EXCEPTION 'Only % left of %.', GREATEST(COALESCE(v_have, 0), 0), v_label
        USING ERRCODE = 'GM001';
    END IF;

    -- The CHECK (stock >= 0) is the backstop if this is ever reached with a
    -- release larger than what was taken.
    UPDATE public.product_variants
       SET stock = stock + v_delta
     WHERE id = v_vid;

    v_touched := v_touched + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'products_touched', v_touched);
END;
$$;

-- The admin Stock page's save. Sets one variant's absolute level; the trigger
-- recomputes the product total, so the page is self-healing by construction.
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
  v_total INTEGER;
BEGIN
  IF p_product_id IS NULL OR p_variant_key IS NULL OR p_variant_key = '' THEN
    RAISE EXCEPTION 'set_variant_stock requires a product id and a variant key' USING ERRCODE = 'GM003';
  END IF;

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative.' USING ERRCODE = 'GM003';
  END IF;

  UPDATE public.product_variants
     SET stock = p_new_stock
   WHERE product_id = p_product_id
     AND variant_key = p_variant_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That variant no longer exists.' USING ERRCODE = 'GM003';
  END IF;

  SELECT stock INTO v_total FROM public.products WHERE id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variant_stock', p_new_stock, 'product_stock', v_total);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Atomic replace, for the admin product form
-- ---------------------------------------------------------------------------
-- The form edits a product's whole variant set at once. Doing that as separate
-- delete and insert calls would leave a window where products.stock read 0.
-- One call, one transaction, and stock never dips.
--
-- Existing rows are updated rather than replaced so their ids survive, which
-- keeps order_items.variant_id pointing at real variants.
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

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'GM003';
  END IF;

  WITH incoming AS (
    SELECT
      NULLIF(btrim(COALESCE(i->>'size',  '')), '') AS size,
      NULLIF(btrim(COALESCE(i->>'color', '')), '') AS color,
      GREATEST(COALESCE((i->>'price')::INTEGER, 0), 0)  AS price,
      GREATEST(COALESCE((i->>'stock')::INTEGER, 0), 0)  AS stock,
      NULLIF(btrim(COALESCE(i->>'sku',       '')), '') AS sku,
      NULLIF(btrim(COALESCE(i->>'barcode',   '')), '') AS barcode,
      NULLIF(btrim(COALESCE(i->>'image_url', '')), '') AS image_url,
      CASE WHEN (i->>'cost') IS NULL THEN NULL
           ELSE GREATEST((i->>'cost')::INTEGER, 0) END AS cost,
      COALESCE((i->>'is_active')::BOOLEAN, true)        AS is_active,
      i.ordinality
    FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS i(value, ordinality)
  ), deduped AS (
    -- Two rows for one combination would violate the unique index. Keep the
    -- last, matching how a later entry in the form wins — which needs the
    -- explicit ordinality below, because DISTINCT ON without a tiebreaker
    -- keeps an arbitrary row rather than a predictable one.
    SELECT DISTINCT ON (public.variant_key(size, color))
           size, color, price, stock, sku, barcode, image_url, cost, is_active
      FROM incoming
     ORDER BY public.variant_key(size, color), ordinality DESC
  ), upserted AS (
    INSERT INTO public.product_variants
      (product_id, size, color, price, stock, sku, barcode, image_url, cost, is_active)
    SELECT p_product_id, size, color, price, stock, sku, barcode, image_url, cost, is_active
      FROM deduped
    ON CONFLICT (product_id, variant_key) DO UPDATE
      SET size      = EXCLUDED.size,
          color     = EXCLUDED.color,
          price     = EXCLUDED.price,
          stock     = EXCLUDED.stock,
          sku       = EXCLUDED.sku,
          barcode   = EXCLUDED.barcode,
          image_url = EXCLUDED.image_url,
          cost      = EXCLUDED.cost,
          is_active = EXCLUDED.is_active
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

-- ---------------------------------------------------------------------------
-- 7. Lock it down, matching 20251101001700
-- ---------------------------------------------------------------------------
-- The storefront reads products directly with the anon key (both
-- lib/supabase/client.ts and lib/supabase/server.ts use it), so variants have
-- to be readable that way too or per-variant prices and stock cannot be shown.
--
-- But cost and barcode are commercially sensitive and must never reach the
-- browser bundle. Row-level security alone cannot express that — it filters
-- rows, not columns — so this uses a column-level GRANT alongside the policy.
-- A consequence worth knowing: `select('product_variants(*)')` FAILS for anon,
-- because expanding `*` touches cost. Anon-key queries must name the columns,
-- which is why lib/commerce/product-variants.ts exports an explicit list.
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'product_variants'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.product_variants', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anon can read variants of active products"
  ON public.product_variants
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_id AND p.is_active = true
    )
  );

REVOKE ALL ON public.product_variants FROM anon, authenticated;

-- Deliberately omits cost, barcode, sku, created_at and updated_at. Add a
-- column here only when something public genuinely needs it.
GRANT SELECT (id, product_id, size, color, variant_key, price, stock, image_url, is_active)
  ON public.product_variants TO anon, authenticated;
