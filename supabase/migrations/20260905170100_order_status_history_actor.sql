-- ============================================================================
-- order_status_history learns who and why
-- ----------------------------------------------------------------------------
-- The table records that an order became 'cancelled' at 14:32. The two
-- questions actually asked when something goes wrong are "who cancelled it"
-- and "why", and neither is answerable from a status and a timestamp.
--
-- audit_log already holds both for admin actions, and the order's History tab
-- reads it. But the status timeline is the thing an operator looks at first —
-- it is on the order, in order, and it includes the transitions the system
-- made on its own. Carrying the actor here means that timeline answers the
-- question without a second lookup, and it stays correct for the entries no
-- admin caused: a sweep that expires a reservation leaves actor_id NULL, which
-- reads as "the system did this" rather than as missing data.
--
-- actor_email is denormalised alongside actor_id for the same reason
-- audit_log.actor_email is: the timeline must stay readable after an admin's
-- auth user is gone, and reading it must not require a join into auth.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS actor_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS reason      text;

COMMENT ON COLUMN public.order_status_history.actor_id IS
  'The admin who made this transition, or NULL when the system did (checkout, an expired-reservation sweep).';
COMMENT ON COLUMN public.order_status_history.reason IS
  'Why, in the admin''s words, where the UI collected one. The answer to "why was this cancelled?".';

-- "What has this admin done to orders" — the same question audit_log_actor_id_idx
-- answers for everything else.
CREATE INDEX IF NOT EXISTS order_status_history_actor_idx
  ON public.order_status_history (actor_id, changed_at DESC)
  WHERE actor_id IS NOT NULL;
