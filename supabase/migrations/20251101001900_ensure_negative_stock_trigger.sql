-- ============================================================================
-- Ensure the prevent_negative_stock trigger exists
-- ----------------------------------------------------------------------------
-- The trigger itself was created by hand in the Supabase dashboard and appears
-- in no migration. 20251101001600 replaces the *function* it calls
-- (check_stock_trigger, changed there from silently clamping negative stock to
-- zero, to raising) but never creates the trigger — so a rebuilt database ends
-- up with the function present and nothing calling it. The guard would appear
-- to be in place while doing nothing.
--
-- No-op on production, which already has the trigger.
-- ============================================================================

DROP TRIGGER IF EXISTS prevent_negative_stock ON public.products;

CREATE TRIGGER prevent_negative_stock
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_trigger();
