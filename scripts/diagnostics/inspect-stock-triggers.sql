-- ============================================================================
-- DIAGNOSTIC ONLY — read-only. Changes nothing.
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor and paste the output back.
--
-- Empirical probing showed a trigger on public.orders that decrements
-- products.stock by the order's total item quantity when status becomes
-- 'confirmed' (clamped at 0), and adds it back when a confirmed order becomes
-- 'cancelled'. It never touches pricing_config, and it doesn't fire for
-- 'ready_for_pickup'. That double-counts against the application's own
-- variant-aware stock handling, so it needs to go — but not before we've read
-- exactly what it does.
--
-- One query, one result set, ordered by section.
--
-- NOTE: pg_get_functiondef() raises 42809 on aggregate functions, so every
-- lookup below is restricted to prokind = 'f' (plain functions).
-- ============================================================================

WITH stock_triggers AS (
  SELECT t.oid       AS trigger_oid,
         t.tgfoid    AS function_oid,
         c.relname   AS table_name,
         t.tgname    AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c      ON c.oid = t.tgrelid
    JOIN pg_namespace n  ON n.oid = c.relnamespace
   WHERE NOT t.tgisinternal
     AND n.nspname = 'public'
     AND c.relname IN ('orders', 'order_items', 'products')
),
drift AS (
  SELECT p.name,
         p.stock AS total_column,
         CASE COALESCE(p.pricing_config->>'mode', 'single')
           WHEN 'single' THEN COALESCE((p.pricing_config->>'singleStock')::int, p.stock)
           ELSE (
             SELECT COALESCE(SUM(value::int), 0)
               FROM jsonb_each_text(
                      COALESCE(p.pricing_config->'combinationStock',
                               p.pricing_config->'sizeStock',
                               p.pricing_config->'colorStock',
                               '{}'::jsonb))
           )
         END AS bucket_sum
    FROM public.products p
   WHERE p.is_active
)

-- 1. Triggers on orders / order_items / products
SELECT '1. trigger' AS section,
       (st.table_name || ' :: ' || st.trigger_name)::text AS name,
       pg_get_triggerdef(st.trigger_oid)::text AS detail
  FROM stock_triggers st

UNION ALL

-- 2. Full source of each trigger function
SELECT '2. trigger function' AS section,
       p.proname::text AS name,
       pg_get_functiondef(p.oid)::text AS detail
  FROM pg_proc p
 WHERE p.prokind = 'f'
   AND p.oid IN (SELECT function_oid FROM stock_triggers)

UNION ALL

-- 3. Any other stock-touching function in public (prosrc, not functiondef, so
--    aggregates and window functions can't blow the query up)
SELECT '3. other stock function' AS section,
       (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text AS name,
       left(p.prosrc, 2000)::text AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND (p.proname ILIKE '%stock%' OR p.prosrc ILIKE '%products%')
   AND p.oid NOT IN (SELECT function_oid FROM stock_triggers)

UNION ALL

-- 4. Existing drift between products.stock and the pricing_config buckets
SELECT '4. drift' AS section,
       d.name::text AS name,
       ('total_column=' || d.total_column
         || '  bucket_sum=' || d.bucket_sum
         || CASE WHEN d.total_column <> d.bucket_sum THEN '  <-- MISMATCH' ELSE '' END)::text AS detail
  FROM drift d

ORDER BY section, name;
