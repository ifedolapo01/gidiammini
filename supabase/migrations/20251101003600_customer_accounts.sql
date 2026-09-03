-- ============================================================================
-- Customer accounts, without passwords
-- ----------------------------------------------------------------------------
-- Checkout is guest-only and the only route back to an order is /track-order
-- with the order number plus the matching email or phone. Lose the number,
-- lose the order — and a repeat customer retypes their name, phone and full
-- delivery address every time, on a phone keyboard.
--
-- WHY NO PASSWORDS
--
-- A password would be a third credential this shop has to store, reset and be
-- breached over, for a customer who buys twice a year and will not remember
-- it. The trust model that already works here is verifyOrderContact: proving
-- control of the email or phone on the order is what grants access to it. This
-- widens that from one order to all of them, and proves control the same way —
-- by sending a link to the address on file.
--
-- TWO TABLES, NOT ONE
--
--   * customer_auth_tokens is the proof-of-control challenge: single use,
--     minutes long, one row per sign-in attempt.
--   * customer_sessions is what the browser then holds: weeks long, revocable,
--     one row per device.
--
-- Collapsing them would mean either a login link that stays valid for a month
-- (a permanent credential sitting in an inbox) or a session that expires in
-- twenty minutes. They are different lifetimes because they are different
-- things.
--
-- ONLY HASHES ARE STORED
--
-- Both tables hold SHA-256 of their token, computed in Node
-- (lib/commerce/bearer-token.ts) — digest() lives in the `extensions` schema
-- on hosted Supabase and does not resolve unqualified. A dump of these tables
-- is not a set of working credentials.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The sign-in challenge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,

  /** SHA-256 of the token in the emailed link. The plaintext exists only in
   *  that email and in the URL the customer clicks. */
  token_hash text NOT NULL UNIQUE,

  /**
   * Short. This is a credential sitting in an inbox, and the customer is
   * expected to click it within a minute or two of asking for it.
   */
  expires_at timestamptz NOT NULL DEFAULT now() + interval '20 minutes',

  /** Set the moment it is exchanged for a session. A second click gets nothing:
   *  a link that works twice is a link that works after being forwarded. */
  used_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- The redemption lookup, and the sweep for expired rows.
CREATE INDEX IF NOT EXISTS customer_auth_tokens_live_idx
  ON public.customer_auth_tokens (expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_auth_tokens_customer_idx
  ON public.customer_auth_tokens (customer_id, created_at DESC);

COMMENT ON TABLE public.customer_auth_tokens IS
  'Single-use, minutes-long sign-in challenges, one row per magic link sent. Holds a SHA-256 hash, never the token. Exchanged for a customer_sessions row.';

-- ---------------------------------------------------------------------------
-- 2. The session
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,

  /** SHA-256 of the value in the customer's cookie. */
  token_hash text NOT NULL UNIQUE,

  /**
   * A row rather than a self-contained JWT, deliberately. This is the one
   * credential that lets somebody read a person's whole order history —
   * addresses included — so it has to be revocable: signing out, or a
   * shopkeeper cutting off a session, must actually take effect. A JWT is
   * valid until it expires no matter what the database says.
   */
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',

  /** Updated at most once a day, so "last used" is answerable without a write
   *  on every page view. */
  last_seen_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx
  ON public.customer_sessions (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx
  ON public.customer_sessions (expires_at);

COMMENT ON TABLE public.customer_sessions IS
  'Signed-in customer devices. Holds a SHA-256 hash of the cookie value, never the value. A row so that a session can actually be revoked.';

-- ---------------------------------------------------------------------------
-- 3. Housekeeping
-- ---------------------------------------------------------------------------
-- Both tables accumulate dead rows — spent challenges and lapsed sessions —
-- and neither is interesting once it is dead. Called by the nightly cron
-- alongside the other sweeps.
CREATE OR REPLACE FUNCTION public.prune_customer_auth(p_keep_days INTEGER DEFAULT 30)
RETURNS TABLE (tokens_deleted bigint, sessions_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_keep INTEGER := GREATEST(COALESCE(p_keep_days, 30), 1);
  v_tokens bigint;
  v_sessions bigint;
BEGIN
  -- Expired or spent, and old enough that nobody is going to ask why their
  -- link did not work.
  DELETE FROM public.customer_auth_tokens
   WHERE created_at < now() - (v_keep || ' days')::interval
     AND (used_at IS NOT NULL OR expires_at < now());
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  DELETE FROM public.customer_sessions WHERE expires_at < now();
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  RETURN QUERY SELECT v_tokens, v_sessions;
END;
$fn$;

COMMENT ON FUNCTION public.prune_customer_auth IS
  'Deletes spent/expired sign-in challenges older than p_keep_days and every lapsed session. Called by /api/cron/customer-auth.';

-- ---------------------------------------------------------------------------
-- 4. Lock it all down
-- ---------------------------------------------------------------------------
-- These two tables are the keys to every customer's order history. Nothing
-- outside the server ever touches them: the cookie goes to the browser, the
-- hash stays here, and every read runs through the service role.
ALTER TABLE public.customer_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('customer_auth_tokens', 'customer_sessions')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.customer_auth_tokens FROM anon, authenticated;
REVOKE ALL ON public.customer_sessions    FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'customers' AS item, count(*)::text AS detail FROM public.customers
UNION ALL
SELECT 'live sign-in links',
       count(*)::text FROM public.customer_auth_tokens
 WHERE used_at IS NULL AND expires_at > now()
UNION ALL
SELECT 'live sessions',
       count(*)::text FROM public.customer_sessions WHERE expires_at > now()
UNION ALL
SELECT 'orders already linked to a customer',
       count(*) FILTER (WHERE customer_id IS NOT NULL)::text || ' of ' || count(*)::text
  FROM public.orders
 ORDER BY item;
