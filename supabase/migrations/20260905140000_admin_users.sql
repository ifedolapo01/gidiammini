-- ============================================================================
-- Admins become real Supabase Auth users
-- ----------------------------------------------------------------------------
-- Until now the admin was an env-var credential (ADMIN_EMAIL +
-- ADMIN_PASSWORD_HASH) checked by app/api/admin/login, which minted a custom
-- HS256 cookie. That works for a single shared login and for nothing else:
--
--   * every action in audit_log is attributed to the same address, so
--     audit_log.actor_id was added in 20251101002700 and left unused,
--   * and the browser holds no Supabase identity at all, which is why the
--     admin tables cannot subscribe to realtime — Realtime enforces RLS, and
--     20251101001700 correctly leaves `orders` readable by nobody but the
--     service role.
--
-- This table is the allowlist that says which auth.users rows are admins. It
-- is deliberately separate from auth.users rather than relying on a claim in
-- the JWT: a claim only changes when a token refreshes, so revoking somebody
-- would leave them working for up to an access token's lifetime. A row here is
-- checked at the moment of the read.
--
-- Shared vs named logins: both are one row per login, and nothing downstream
-- of the auth layer cares which it is looking at. A deployment that wants one
-- shared admin has one row; this one has a row per person.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Denormalised from auth.users so the admin list and the audit trail can be
  -- read without granting anything access to the auth schema.
  email      text NOT NULL,
  name       text,
  role       text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  -- Deactivating rather than deleting keeps the audit trail's actor_id
  -- resolvable after somebody leaves.
  is_active  boolean NOT NULL DEFAULT true,
  -- Stamped at sign-in, so an admin list can show who is still actually using
  -- the store rather than only who was once given an account.
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_users IS
  'Which auth.users may administer the store. Checked by every admin RLS policy through is_active_admin(), and by the server on every admin API request.';

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key
  ON public.admin_users (lower(email));

-- ---------------------------------------------------------------------------
-- The rule, in one place
-- ---------------------------------------------------------------------------
-- Every admin policy calls this rather than repeating the EXISTS, so widening
-- or narrowing who counts as an admin is a single edit.
--
-- SECURITY DEFINER because the caller is the `authenticated` role, which has
-- no grant on admin_users and must not get one: an admin's own row is not
-- something the browser needs to read, and a policy that required it would be
-- recursive. STABLE so the planner evaluates it once per statement rather than
-- once per row.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_users a
     WHERE a.user_id = auth.uid()
       AND a.is_active
  );
$$;

COMMENT ON FUNCTION public.is_active_admin() IS
  'True when the current JWT belongs to an active admin. The single definition of "is an admin" for every RLS policy.';

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- The table itself is service-role only
-- ---------------------------------------------------------------------------
-- Admins are managed by the server (scripts/create-admin.mjs and, later, an
-- admin-management screen), never from the browser. RLS on with no policies
-- means anon and authenticated can do nothing here; service_role bypasses RLS.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'admin_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_users', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.admin_users FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_admin_users_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_touch_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_touch_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_admin_users_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log.actor_id stops being decorative
-- ---------------------------------------------------------------------------
-- The column was added in 20251101002700 and documented as unused because
-- there was only ever one shared login to attribute anything to. Now that an
-- action belongs to a person, index it — "what did this admin change" is the
-- question the column exists to answer.
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx
  ON public.audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
