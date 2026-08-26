-- ============================================================================
-- Remove the competing stock paths, and repair the drift they caused
-- ----------------------------------------------------------------------------
-- Run AFTER scripts/add-stock-reservation.sql.
--
-- Diagnosis (from scripts/inspect-stock-triggers.sql):
--
--   stock_update_trigger -> update_product_stock() on public.orders
--     Decrements products.stock on any status change into 'confirmed', and
--     adds it back only on the exact transition 'confirmed' -> 'cancelled'.
--     Four separate problems:
--       a) It duplicates what the application already does. Every confirm
--          decremented stock twice — once here (total only) and once via
--          applyOrderStockChange (total AND the pricing_config bucket). This is
--          the cause of the existing drift repaired in step 4 below, and it is
--          almost certainly why scripts/fix-drifted-product-stock.sql exists.
--       b) It never touches pricing_config, so the per-variant numbers that
--          getVariantStock() actually shows customers were never adjusted here.
--       c) `UPDATE products p ... FROM order_items oi WHERE oi.order_id = ...`
--          applies only ONE matching order_items row per product. An order
--          containing two variants of the same product silently under-counts.
--       d) It ignores pickup fulfilment entirely — 'ready_for_pickup' and
--          'picked_up' never fire it — so pickup orders behaved differently
--          from delivery orders.
--     Superseded by adjust_order_stock(), which is atomic, variant-aware,
--     handles every status, and is driven from one place in the application.
--
--   prevent_negative_stock -> check_stock_trigger() on public.products
--     Silently rewrote any negative stock to 0. That is what hid problem (a):
--     the second decrement pushed totals below zero and this floored them,
--     turning a loud bug into quiet data loss. Rewritten below to raise
--     instead, so a path that would oversell fails visibly.
--
--   check_and_decrease_stock_multi / decrease_product_stock x2 /
--   increase_product_stock
--     All unreferenced by the application. Two are outright broken: they
--     compare products.id (uuid) with a text value, so they raise
--     `operator does not exist: uuid = text` on any non-empty input. Dropped
--     so nobody wires them in believing they work.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove the duplicate stock trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS stock_update_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.update_product_stock();

-- ---------------------------------------------------------------------------
-- 2. Make negative stock loud instead of silent
-- ---------------------------------------------------------------------------
-- Kept as a safety net, but it must never quietly absorb a mistake again.
-- adjust_order_stock() checks availability before writing, so in normal
-- operation this never fires; if it does, something is wrong and we want to
-- hear about it rather than discover it in a stock count weeks later.
CREATE OR REPLACE FUNCTION public.check_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock < 0 THEN
    RAISE EXCEPTION 'Stock for product % would go negative (%). Refusing the write.',
                    NEW.id, NEW.stock
      USING ERRCODE = 'GM002';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop the unused / broken stock functions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.check_and_decrease_stock_multi(JSONB);
DROP FUNCTION IF EXISTS public.decrease_product_stock(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.decrease_product_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.increase_product_stock(UUID, INTEGER);

-- ---------------------------------------------------------------------------
-- 4. Repair the existing drift
-- ---------------------------------------------------------------------------
-- The pricing_config buckets are authoritative: they are what getVariantStock()
-- reads for per-variant availability, and the duplicate trigger never touched
-- them. products.stock is the column that was over-decremented, so it is the
-- one that gets corrected — always upward, back to the sum of the buckets.
--
-- Products with no pricing_config are left alone: for them the total is the
-- only number there is, so there is nothing to reconcile against.
--
-- The RETURNING clause prints exactly what changed. Nothing else is touched.
WITH bucket_totals AS (
  SELECT p.id,
         p.name,
         p.stock AS old_total,
         CASE COALESCE(p.pricing_config->>'mode', 'single')
           WHEN 'single' THEN (p.pricing_config->>'singleStock')::int
           ELSE (
             SELECT SUM(value::int)
               FROM jsonb_each_text(
                      COALESCE(p.pricing_config->'combinationStock',
                               p.pricing_config->'sizeStock',
                               p.pricing_config->'colorStock',
                               '{}'::jsonb))
           )
         END AS bucket_sum
    FROM public.products p
   WHERE p.pricing_config IS NOT NULL
)
UPDATE public.products p
   SET stock = bt.bucket_sum
  FROM bucket_totals bt
 WHERE p.id = bt.id
   AND bt.bucket_sum IS NOT NULL
   AND bt.bucket_sum <> bt.old_total
RETURNING p.name, bt.old_total AS was, p.stock AS now_is;
