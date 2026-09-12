-- ============================================================================
-- Admin roles: a cashier who can only ring up a counter sale
-- ----------------------------------------------------------------------------
-- 20260905170000 gave admins four roles: owner / manager / fulfilment /
-- read_only. None of them fit a till operator — the narrowest of the four,
-- read_only, cannot create anything, and fulfilment can already read and
-- write every order and its stock, which is far more reach than "sell what is
-- in front of you and print a receipt" needs.
--
-- 'cashier' is that fifth, narrower role: exactly one permission
-- (counter_sale:write, see lib/api/admin-roles.ts), granted by
-- 20260912150000 alongside the counter-sale feature itself. Widened here
-- first so a role the application does not yet grant to anyone can still be
-- assigned the moment the rest of the feature lands.
--
-- Safe to run more than once.
-- ============================================================================

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'admin_users'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_users DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'manager', 'fulfilment', 'read_only', 'cashier'));

COMMENT ON COLUMN public.admin_users.role IS
  'owner | manager | fulfilment | read_only | cashier. What each grants is defined in lib/api/admin-roles.ts and enforced centrally in withAdminAuth.';
