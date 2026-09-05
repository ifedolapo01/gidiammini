-- ============================================================================
-- The abandoned-cart sweep, scheduled from Postgres instead of Vercel
-- ----------------------------------------------------------------------------
-- WHY THIS IS NOT IN vercel.json
--
-- The sweep has to run hourly: lib/commerce/abandoned-cart.ts sets
-- FIRST_REMINDER_HOURS = 1, and the route works through a backlog 50 carts at
-- a time expecting hourly passes. Vercel's Hobby plan only accepts once-a-day
-- schedules and rejects the deployment outright for anything finer, so a
-- sub-daily expression there is not a slower job — it is a failed deploy.
--
-- The other six jobs are all daily and stay in vercel.json. Only this one
-- moved.
--
-- WHY THIS IS NOT A MIGRATION
--
-- supabase/migrations holds schema, and is verified to replay onto an empty
-- PostgreSQL. This is neither: it needs two extensions enabled out of band, and
-- it depends on values that differ per deployment (the site's URL) and one that
-- must never be committed (the cron secret). It lives here so the schedule is
-- still in version control rather than only in somebody's SQL editor history —
-- which is the thing supabase/migrations/README.md exists to prevent.
--
-- Run the whole file once, in the Supabase SQL editor, after the two secrets
-- below exist. Re-running is safe: cron.schedule() replaces a job of the same
-- name rather than adding a second one.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
-- pg_cron runs the schedule; pg_net makes the outbound HTTP call. Both are
-- available on every Supabase plan. If these fail here, enable them from
-- Dashboard -> Database -> Extensions instead and re-run from section 2.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ---------------------------------------------------------------------------
-- 2. Configuration, in Vault rather than in the job body
-- ---------------------------------------------------------------------------
-- cron.job stores its command as plain text and is readable by anyone who can
-- reach the database. Putting the bearer token straight in it would leave a
-- live credential sitting in a table, so both values are read from Vault at
-- call time and only their names appear below.
--
-- EDIT THESE TWO before running. CRON_SECRET must match the value set in
-- Vercel, or every call comes back 401 — see lib/api/cron-auth.ts.
SELECT vault.create_secret(
  'https://YOUR-DOMAIN/api/cron/abandoned-carts',
  'abandoned_cart_cron_url',
  'Endpoint pg_cron calls each hour for the abandoned-cart sweep.'
);

SELECT vault.create_secret(
  'YOUR_CRON_SECRET',
  'cron_secret',
  'Bearer token every /api/cron route checks. Must equal CRON_SECRET in Vercel.'
);

-- To change one later (create_secret errors on a name that already exists):
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
--     'the-new-value'
--   );


-- ---------------------------------------------------------------------------
-- 3. The schedule
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'abandoned-cart-sweep',
  '0 * * * *',
  $job$
    SELECT net.http_get(
      url := (
        SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name = 'abandoned_cart_cron_url'
      ),
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name = 'cron_secret'
        )
      ),
      -- Generous, but it only governs how long pg_net waits to RECORD a
      -- response. The request is dispatched by a background worker, so a
      -- timeout here means the reply was not captured — not that the sweep
      -- stopped. The route's own maxDuration (300s) is what bounds the work.
      timeout_milliseconds := 60000
    );
  $job$
);


-- ---------------------------------------------------------------------------
-- 4. Checking on it
-- ---------------------------------------------------------------------------
-- Is it scheduled?
--   SELECT jobid, schedule, active FROM cron.job WHERE jobname = 'abandoned-cart-sweep';
--
-- Did the last few runs fire? (status here is pg_cron's, not the endpoint's)
--   SELECT status, return_message, start_time
--     FROM cron.job_run_details
--    WHERE jobname = 'abandoned-cart-sweep'
--    ORDER BY start_time DESC
--    LIMIT 10;
--
-- What did the endpoint actually answer? The body is the route's JSON:
-- {"success":true,"sent":N,...}. A 401 means the two CRON_SECRETs disagree.
--   SELECT status_code, content, created
--     FROM net._http_response
--    ORDER BY created DESC
--    LIMIT 10;
--
-- Stop it:
--   SELECT cron.unschedule('abandoned-cart-sweep');
