-- ============================================================================
-- Row-level security: stop the anon key from reading customer data
-- ----------------------------------------------------------------------------
-- Findings from probing the live database with the public anon key (the one
-- that ships in the JS bundle):
--
--   WRITES ARE ALREADY BLOCKED, everywhere. Real INSERT/UPDATE attempts as anon
--   were refused on products, orders, order_items, categories, subcategories,
--   shipping_zones and discounts ("new row violates row-level security policy").
--   There is no vandalism vector and nothing to fix on that side.
--
--   READS ARE NOT. The anon key can SELECT every row of:
--       orders                 -> customer_name, customer_email, customer_phone,
--                                 delivery_address, receipt_url, total_amount
--       order_items            -> what everyone bought
--       order_change_requests  -> customer notes
--   Any visitor can dump the whole order history from a browser console. Worse,
--   receipt_url is a working public URL: fetching the values read from this
--   table returned HTTP 200 image/png for all three real orders, i.e. anyone
--   can download customers' bank transfer receipts. Closing the read access
--   below removes the way those URLs are discovered; making the storage bucket
--   itself private is tracked separately.
--
--   products is already correct: anon sees only is_active = true rows
--   (verified: 2 of 3 products visible). Restated below so the intended state
--   is declarative and version-controlled rather than implicit.
--
--   service_role bypasses RLS on this database — verified: it reads all 6 rows
--   of order_status_history (RLS on, no anon-visible policy) where anon reads
--   0. The REVOKEs below name only anon and authenticated, so every server
--   path keeps working.
--
-- Nothing in the application reads these three tables from the browser. Every
-- access lives under app/api/ and uses the service-role client, which bypasses
-- RLS entirely — so removing anon's access changes no behaviour. Verified by
-- grepping every `.from('orders')` / `.from('order_items')` /
-- `.from('order_change_requests')` call site.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make sure RLS is actually on everywhere it matters
-- ---------------------------------------------------------------------------
ALTER TABLE public.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Remove every policy on the order tables
-- ---------------------------------------------------------------------------
-- The target state is "anon and authenticated can do nothing here". With RLS
-- enabled and no policies at all, that is exactly what you get, and there is
-- no policy left that a future change could accidentally widen. service_role
-- is unaffected: it bypasses RLS and needs no policy.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('orders', 'order_items', 'order_change_requests', 'order_status_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Dropped policy "%" on public.% (it exposed data to the anon key)', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Belt and braces: take the table grants away too
-- ---------------------------------------------------------------------------
-- Supabase grants SELECT on public tables to anon/authenticated by default.
-- RLS alone is enough today, but revoking means that if someone later adds a
-- broad policy by mistake, the grant still isn't there to make it usable.
REVOKE ALL ON public.orders                FROM anon, authenticated;
REVOKE ALL ON public.order_items           FROM anon, authenticated;
REVOKE ALL ON public.order_change_requests FROM anon, authenticated;
REVOKE ALL ON public.order_status_history  FROM anon, authenticated;
REVOKE ALL ON public.subscribers           FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. products: state the storefront's read access explicitly
-- ---------------------------------------------------------------------------
-- The storefront reads products directly from the browser (product listing,
-- product detail, and the checkout stock re-check), so anon needs SELECT — but
-- only on active products, and nothing else.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='products'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anon can read active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

REVOKE ALL     ON public.products FROM anon, authenticated;
GRANT  SELECT  ON public.products TO   anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. subscribers: the newsletter signs up through the server, not the browser
-- ---------------------------------------------------------------------------
-- create-subscribers.sql added an "allow public inserts" policy for a
-- browser-side signup that no longer exists — /api/subscribe uses the
-- service-role client. Leaving it open is a free mailing-list spam vector.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='subscribers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscribers', r.policyname);
    RAISE NOTICE 'Dropped policy "%" on public.subscribers', r.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT c.relname                                        AS table_name,
       CASE WHEN c.relrowsecurity THEN 'on' ELSE 'OFF' END AS rls,
       COALESCE((SELECT count(*)::text FROM pg_policies pp
                  WHERE pp.schemaname = 'public' AND pp.tablename = c.relname), '0') AS policies,
       COALESCE((SELECT string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type)
                   FROM information_schema.role_table_grants g
                  WHERE g.table_schema = 'public'
                    AND g.table_name = c.relname
                    AND g.grantee = 'anon'), '(none)') AS anon_grants
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN ('products','orders','order_items','order_change_requests',
                     'order_status_history','subscribers','discounts','categories',
                     'subcategories','shipping_zones','shipping_zone_exceptions')
 ORDER BY c.relname;
