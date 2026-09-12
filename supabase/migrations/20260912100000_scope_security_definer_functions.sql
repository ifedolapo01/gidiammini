-- ============================================================================
-- Store-scoping the functions that were exempt from it
-- ----------------------------------------------------------------------------
-- 20260911100000 built the store dimension and app_service, but named one
-- gap explicitly rather than pretending it wasn't there: a SECURITY DEFINER
-- function runs with its *owner's* privileges, not the caller's, and every
-- function this database has was created by (and is therefore owned by)
-- postgres -- a superuser, which bypasses RLS regardless of any policy on the
-- tables it touches. list_products(), search_products(), edit_order_items(),
-- set_variant_stock() and the rest were, until this migration, reading and
-- writing every store's rows no matter which role called them.
--
-- The fix is a change of owner, not of behaviour: `ALTER FUNCTION ... OWNER TO
-- app_service` touches no signature and no function body. Once app_service
-- owns a SECURITY DEFINER function, its internal queries run as app_service,
-- which means they run under the exact same store-scoping RLS policies
-- 20260911100000 already wrote for every table these functions touch --
-- nothing new to grant, since app_service's table access there is already
-- blanket and the row filter is already in place.
--
-- Signatures are looked up through pg_proc rather than hand-typed, the same
-- defence 20260910130000 already uses for this exact reason: several of these
-- functions (list_products, product_candidates, count_products,
-- product_facet_options, search_products, product_cards,
-- storefront_traffic_without_sales) have had their signature replaced outright
-- at least once, via an explicit DROP FUNCTION, specifically because
-- CREATE OR REPLACE cannot change a return type or an argument type. A
-- mistyped signature here would make the ALTER silently match nothing.
--
-- WHAT IS DELIBERATELY LEFT OWNED BY postgres
--
--   * is_active_admin() -- who may administer the store is a different
--     question from which store's rows a query sees, and it must keep
--     reading admin_users (locked to service-role-equivalent access, on
--     purpose) regardless of any store context.
--   * Functions that touch only the tables 20260911100000 also left
--     unscoped (check_rate_limit/reset_rate_limit/prune_rate_limits on
--     rate_limits, prune_audit_log/audit_log_is_append_only on audit_log) --
--     reassigning them would be a no-op at best, since app_service's policy
--     there is already unconditional, and pure surface for no benefit.
--   * Plain `touch_*_updated_at` triggers -- they write only the row already
--     being inserted/updated by the caller's own statement and touch no
--     other table, so ownership was never doing anything for them.
--
-- Safe to run more than once: OWNER TO on a role a function already has is a
-- no-op, and the pg_proc lookup below simply finds nothing to change on a
-- function that already belongs to app_service.
-- ============================================================================

-- The connecting role must be a member of app_service to reassign ownership
-- to it -- CREATE ROLE in 20260911100000 did not itself confer membership,
-- only the explicit GRANT to authenticator did. Granted dynamically to
-- whichever role is actually running this migration rather than hand-naming
-- it, since that name is an operational detail of how `db push` connects
-- (verified live: the first attempt at this migration failed exactly here,
-- "permission denied for schema public", before this line existed).
DO $$
BEGIN
  EXECUTE format('GRANT app_service TO %I', current_user);
END $$;

-- Reassigning an object's owner also requires the *new* owner to hold CREATE
-- on the containing schema (Postgres will not let an object be owned by a
-- role that has no standing to create anything there) -- 20260911100000
-- granted app_service USAGE on public but not CREATE, which is why the ALTER
-- FUNCTION loop below failed live with "permission denied for schema public"
-- until this was added.
GRANT CREATE ON SCHEMA public TO app_service;

DO $$
DECLARE
  fn record;
  target_names text[] := ARRAY[
    -- Product listing, search and facets (products, categories,
    -- subcategories, subsubcategories, product_variants)
    'list_products', 'product_candidates', 'count_products',
    'product_facet_options', 'search_products', 'product_cards',
    'suggest_products', 'top_categories',

    -- Order and stock mutation (orders, order_items, product_variants,
    -- products, inventory_movements)
    'adjust_order_stock', 'edit_order_items', 'set_variant_stock',
    'sync_variants_from_pricing_config', 'replace_product_variants',
    'record_inventory_movement', 'product_variants_sync_total',
    'sync_product_stock_total', 'check_stock_trigger',

    -- Order numbering (store_settings, plus the deferred
    -- order_number_reservations app_service already has unconditionally)
    'reserve_order_number',

    -- Recommendations (product_pairs, products, order_items)
    'rebuild_product_pairs', 'related_product_ids', 'co_purchased_product_ids',

    -- Returns lifecycle (orders, order_items, returns, return_items,
    -- product_variants)
    'create_return', 'restock_return_item',

    -- Triggers that maintain a derived column on a scoped table from
    -- another scoped table
    'sync_discount_redemption_count', 'sync_order_amount_refunded',
    'sync_order_amount_paid', 'order_refunds_guard_update',
    'normalise_customer_tags', 'products_build_search_vector',

    -- Customer-account housekeeping (customer_auth_tokens, customer_sessions)
    'prune_customer_auth',

    -- Reporting over storefront_events joined against scoped product/order
    -- data
    'storefront_funnel', 'storefront_traffic_without_sales'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(target_names)
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_service', fn.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Report what now belongs to app_service, for a human to check against the
-- list above before this is pushed.
-- ---------------------------------------------------------------------------
SELECT p.proname AS function_name,
       p.oid::regprocedure AS signature,
       r.rolname AS owner,
       p.prosecdef AS security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
 WHERE n.nspname = 'public'
   AND (r.rolname = 'app_service' OR p.proname = 'is_active_admin')
 ORDER BY p.proname;
