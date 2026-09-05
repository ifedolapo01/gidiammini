-- ============================================================================
-- Admin roles: owner / manager / fulfilment / read-only
-- ----------------------------------------------------------------------------
-- 20260905140000 gave admins per-person identity but only two roles, 'owner'
-- and 'staff', and nothing anywhere checked either of them. Every admin could
-- therefore do everything: the warehouse assistant who needs to adjust a stock
-- count could also delete a product, change a price and read every customer's
-- address.
--
-- This widens the vocabulary to the four roles the application enforces in
-- lib/api/admin-roles.ts, which is the authority on what each one may do. The
-- constraint here exists so the database cannot hold a role the application
-- has no rules for — not to describe the rules themselves.
--
--   owner      full access, including managing admins
--   manager    runs the shop; cannot manage admins
--   fulfilment orders and stock only
--   read_only  looks, changes nothing
--
-- 'staff' becomes 'manager': it was granted everything in practice, and
-- silently demoting a working account on deploy would lock somebody out of a
-- job they were doing yesterday. Narrowing an individual is a deliberate act
-- in the team screen.
--
-- Also adds the columns the invite flow needs. An invited admin exists as a
-- row here before they have ever signed in, so the team list can show a
-- pending invitation rather than a name that appeared from nowhere.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Widen the role constraint
-- ---------------------------------------------------------------------------
-- The old constraint was declared inline, so it is dropped by looking it up
-- rather than by a name this migration would have to guess correctly.
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

-- Before the new constraint, or the rows it does not yet satisfy would block it.
UPDATE public.admin_users SET role = 'manager' WHERE role = 'staff';

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'manager', 'fulfilment', 'read_only'));

COMMENT ON COLUMN public.admin_users.role IS
  'owner | manager | fulfilment | read_only. What each grants is defined in lib/api/admin-roles.ts and enforced centrally in withAdminAuth.';

-- ---------------------------------------------------------------------------
-- Invitation and revocation
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS invited_at      timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivated_at  timestamptz;

COMMENT ON COLUMN public.admin_users.invited_at IS
  'When the invitation was sent. Together with last_seen_at IS NULL this is what makes an invitation show as still pending.';
COMMENT ON COLUMN public.admin_users.deactivated_at IS
  'When access was revoked. The row stays so audit_log.actor_id still resolves to a person.';

-- The team list is "active first, then everyone else" — small enough that the
-- index is about intent rather than speed, but it costs nothing.
CREATE INDEX IF NOT EXISTS admin_users_active_idx
  ON public.admin_users (is_active, created_at DESC);
