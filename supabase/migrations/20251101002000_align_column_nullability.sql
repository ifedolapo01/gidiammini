-- ============================================================================
-- Align database nullability with what the application already assumes
-- ----------------------------------------------------------------------------
-- Four columns were created nullable-with-a-default, but the TypeScript types
-- have always declared them non-null:
--
--   orders.status            types/order.ts   -> status: OrderStatus
--   orders.payment_verified  types/order.ts   -> payment_verified: boolean
--   products.stock           types/product.ts -> stock: number
--   products.is_active       types/product.ts -> is_active: boolean
--
-- A default only applies when the column is omitted from an INSERT; an explicit
-- NULL is still accepted. So a single bad write could put a NULL status on an
-- order, and every `switch (order.status)` and `hasStockReserved(status)` in the
-- codebase would silently take the wrong branch. Generating typed database
-- clients is what surfaced this — the generated types said `string | null`
-- where the app said `OrderStatus`.
--
-- Verified before writing: production has 0 NULL rows in all four columns, so
-- the backfills below are no-ops there and SET NOT NULL cannot fail. They are
-- kept anyway so the migration is safe on any database.
-- ============================================================================

UPDATE public.orders   SET status           = 'pending' WHERE status IS NULL;
UPDATE public.orders   SET payment_verified = false     WHERE payment_verified IS NULL;
UPDATE public.products SET stock            = 0         WHERE stock IS NULL;
UPDATE public.products SET is_active        = true      WHERE is_active IS NULL;

ALTER TABLE public.orders   ALTER COLUMN status           SET NOT NULL;
ALTER TABLE public.orders   ALTER COLUMN payment_verified SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN stock            SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN is_active        SET NOT NULL;
