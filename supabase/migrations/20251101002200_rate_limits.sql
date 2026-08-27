-- ============================================================================
-- Rate limiting for the public API surface
-- ----------------------------------------------------------------------------
-- Backed by Postgres rather than Redis. The usual recommendation is an Upstash
-- sliding window, but that means a second vendor, another set of credentials,
-- and another thing that can be down — for a store doing single-digit orders a
-- day, against a database that is already a hard dependency of every request
-- being limited. One extra round trip per public request is a fair trade.
--
-- WHY A TABLE AND NOT IN-MEMORY: the app runs on serverless functions, so an
-- in-process counter is per-instance and resets on every cold start. An
-- attacker gets the full limit per instance, which is no limit at all.
--
-- WINDOW MODEL: fixed window, not sliding. `hits` is upserted against a window
-- aligned to a multiple of the window length, so the whole check is one
-- statement and one row. The known trade-off is that a burst straddling a
-- boundary can briefly land up to 2x the limit. That is acceptable here —
-- the point is to stop enumeration and quota abuse, not to meter billing.
--
-- TABLE SIZE: rows are keyed and UPDATEd, never appended, so the table grows
-- with the number of distinct (bucket, identifier) pairs — not with request
-- volume. Stale rows are swept by app/api/cron/stock-reservations.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limits_updated_at_idx ON public.rate_limits (updated_at);

-- Nothing client-facing ever touches this table; every check runs through the
-- service-role client, which bypasses RLS.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- check_rate_limit — count this request and say whether it is allowed
-- ---------------------------------------------------------------------------
-- p_key      : bucket + identifier, e.g. 'login:203.0.113.4'
-- p_limit    : requests permitted per window
-- p_window_seconds : window length
-- p_count    : false to read the current state without consuming a request
--
-- Returns { allowed, hits, limit, remaining, reset_at, retry_after }.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER,
  p_count          BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
  v_reset_at     TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_limit IS NULL OR p_limit < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'check_rate_limit requires a key, a positive limit and a positive window';
  END IF;

  -- Align to the start of the current fixed window.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  IF p_count THEN
    INSERT INTO public.rate_limits AS rl (key, window_start, hits, updated_at)
    VALUES (p_key, v_window_start, 1, v_now)
    ON CONFLICT (key) DO UPDATE
      -- rl.* is the existing row; a new window resets the counter to 1.
      SET hits = CASE WHEN rl.window_start = v_window_start THEN rl.hits + 1 ELSE 1 END,
          window_start = v_window_start,
          updated_at = v_now
    RETURNING rl.hits INTO v_hits;
  ELSE
    SELECT CASE WHEN rl.window_start = v_window_start THEN rl.hits ELSE 0 END
      INTO v_hits
      FROM public.rate_limits rl
     WHERE rl.key = p_key;
    v_hits := COALESCE(v_hits, 0);
  END IF;

  RETURN jsonb_build_object(
    'allowed',     v_hits <= p_limit,
    'hits',        v_hits,
    'limit',       p_limit,
    'remaining',   GREATEST(p_limit - v_hits, 0),
    'reset_at',    v_reset_at,
    'retry_after', GREATEST(CEIL(EXTRACT(epoch FROM (v_reset_at - v_now)))::INTEGER, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- reset_rate_limit — clear one key
-- ---------------------------------------------------------------------------
-- Used after a successful login, so a legitimate admin who fat-fingered their
-- password a few times isn't still carrying those failures around.
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_key TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION public.reset_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- prune_rate_limits — housekeeping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
   WHERE updated_at < NOW() - make_interval(hours => p_older_than_hours);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_rate_limits(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_rate_limits(INTEGER) TO service_role;
