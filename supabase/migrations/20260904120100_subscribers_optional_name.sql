-- ============================================================================
-- A newsletter signup no longer has to carry a name.
--
-- `subscribers.name` was NOT NULL because the only thing that ever wrote to
-- this table was the checkout opt-in, which already had the customer's first
-- and last name. The footer signup — one field and an arrow, on every page of
-- the site — has no name to send, and asking for one there costs more
-- subscribers than the greeting in the welcome email is worth.
--
-- The welcome email falls back to "Hi there" when the column is NULL, and the
-- discount campaigns only ever read `email`.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.subscribers
  ALTER COLUMN name DROP NOT NULL;

COMMENT ON COLUMN public.subscribers.name IS
  'Subscriber name when we have one — the checkout opt-in sends it, the footer signup does not. NULL is greeted as "there".';
