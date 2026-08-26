-- Reconciles products.stock (a flat total) with pricing_config's per-variant
-- stock buckets — the actual source of truth the admin Stock page reads from.
--
-- Root cause this repairs: checkout used to decrement products.stock directly
-- via a Postgres RPC the moment an order was created, before payment was even
-- verified, and never restored it for orders that stayed pending or were
-- cancelled pre-confirmation. That's been fixed in app/api/orders/route.ts
-- (stock is now only ever reserved at order confirmation), but any stock
-- values already drifted down by that bug need a one-time correction here.
--
-- Safe to run any time — it only recomputes the aggregate total from
-- pricing_config, which this script does not touch.

UPDATE public.products
SET stock = CASE pricing_config ->> 'mode'
  WHEN 'single' THEN COALESCE((pricing_config ->> 'singleStock')::int, stock)
  WHEN 'size' THEN COALESCE(
    (SELECT SUM(value::int) FROM jsonb_each_text(pricing_config -> 'sizeStock')), 0
  )
  WHEN 'color' THEN COALESCE(
    (SELECT SUM(value::int) FROM jsonb_each_text(pricing_config -> 'colorStock')), 0
  )
  WHEN 'combination' THEN COALESCE(
    (SELECT SUM(value::int) FROM jsonb_each_text(pricing_config -> 'combinationStock')), 0
  )
  ELSE stock
END
WHERE pricing_config IS NOT NULL;
