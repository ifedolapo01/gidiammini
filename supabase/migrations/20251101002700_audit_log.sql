-- ============================================================================
-- audit_log: who changed what, when, and why
-- ----------------------------------------------------------------------------
-- order_status_history records a status and a timestamp. It does not record who
-- made the change or why, and nothing else in the schema is recorded at all —
-- price edits, product deletions, discount changes, stock adjustments and
-- shipping overrides all leave no trace whatsoever.
--
-- Combined with a single shared admin login, that means no accountability: when
-- a price is wrong or an order was cancelled by mistake, there is no way to find
-- out what happened.
--
-- DESIGN NOTES
--
-- entity_id is text, not uuid. Most entities are uuid-keyed, but not all: a
-- stock adjustment is addressed by variant_key ('3-5 months|Yellow') and a
-- category by slug. A uuid column would force those to be logged as something
-- they are not, or not logged at all.
--
-- before/after are jsonb. For an update they hold only the fields that actually
-- changed, so a row stays readable and a diff is obvious at a glance; for a
-- create or delete they hold the whole record. The application does the
-- diffing (lib/api/audit.ts) because only it knows which fields are secrets.
--
-- actor_id is nullable and unused for now. The store has one shared admin
-- login, so actor_email is all that can honestly be recorded. The column exists
-- so that when per-user admin accounts arrive, history written before them
-- stays valid rather than needing a schema change.
--
-- APPEND-ONLY
--
-- A trigger refuses UPDATE. An audit entry that can be edited is not evidence,
-- and the realistic risk is not a determined attacker (anyone holding the
-- service-role key already owns the database) but a well-meaning script
-- "correcting" history. DELETE is deliberately still allowed, because data
-- retention has to be possible; prune_audit_log below is the intended route.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /** Reserved for per-admin accounts. See the header. */
  actor_id uuid,
  /** Who, as far as a shared login can tell. NULL only if the token had none. */
  actor_email text,

  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,

  before jsonb,
  after jsonb,
  /** Free text from the admin, where the UI collects one. */
  reason text,

  -- Request context, so an entry can be tied back to the call that made it.
  method text,
  path text,
  ip text,
  status_code integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- The per-entity "History" query: everything that happened to this order.
CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON public.audit_log (entity_type, entity_id, created_at DESC);

-- The activity feed: everything, newest first.
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON public.audit_log (created_at DESC);

-- "What has this admin been doing", once there is more than one.
CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON public.audit_log (actor_email, created_at DESC)
  WHERE actor_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON public.audit_log (action, created_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Append-only record of admin actions: actor, entity, action, before/after diff, reason. Written automatically by withAdminAuth.';

-- ---------------------------------------------------------------------------
-- Append-only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; entries cannot be modified.'
    USING ERRCODE = 'GM004';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_is_append_only();

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- The only intended way to remove entries. Returns how many it removed so a
-- cron can report it.
CREATE OR REPLACE FUNCTION public.prune_audit_log(p_older_than_days INTEGER DEFAULT 730)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_older_than_days IS NULL OR p_older_than_days < 30 THEN
    RAISE EXCEPTION 'Refusing to prune audit history younger than 30 days.'
      USING ERRCODE = 'GM004';
  END IF;

  DELETE FROM public.audit_log
   WHERE created_at < now() - make_interval(days => p_older_than_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lock it down, matching 20251101001700
-- ---------------------------------------------------------------------------
-- Audit entries hold before/after snapshots of orders and customers, so they
-- are at least as sensitive as the tables they describe. Nothing in the browser
-- reads this; the admin feed goes through the service-role client.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'audit_log'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_log', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.audit_log FROM anon, authenticated;
