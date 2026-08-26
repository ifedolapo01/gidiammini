-- ============================================================================
-- Lock down the orphaned public.users table
-- ----------------------------------------------------------------------------
-- Found while generating typed database clients: production has a `users` table
-- that no migration defines and no application code references —
--
--   users(id, email, password_hash, role, created_at, updated_at)
--
-- It is an abandoned first attempt at real authentication. The admin auth that
-- actually runs is an env-var credential plus a signed JWT cookie
-- (lib/auth.ts, app/api/admin/login), which touches no table at all.
--
-- The problem: the public anon key could SELECT it, `password_hash` and all.
-- It holds 0 rows today, so nothing has leaked — but any future insert would be
-- world-readable immediately. 20251101001700 missed it because nobody knew the
-- table was there; it appears in no migration, so there was nothing to read.
--
-- Guarded with a to_regclass check rather than a plain ALTER: the table exists
-- only on production, so a database rebuilt from these migrations won't have it
-- and should not fail here. Not recreating it is deliberate — a rebuilt
-- environment is better off without it.
--
-- NOTE: dropping the table outright is the cleaner end state (you cannot leak
-- what does not exist) and is safe given 0 rows and no references. Left in
-- place rather than dropped because that is a destructive, irreversible call
-- that belongs to whoever owns the data, not to a migration written for them.
--
-- Safe to run more than once.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'public.users does not exist here — nothing to lock down.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';

  -- RLS on with no policies at all = no access for anon/authenticated, and no
  -- policy left that a later change could widen by accident. service_role
  -- bypasses RLS and needs no policy.
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
    RAISE NOTICE 'Dropped policy "%" on public.users', r.policyname;
  END LOOP;

  -- Belt and braces: take the underlying grants away too.
  EXECUTE 'REVOKE ALL ON public.users FROM anon, authenticated';

  RAISE NOTICE 'public.users is now inaccessible to the anon and authenticated roles.';
END $$;
