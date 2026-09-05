-- ============================================================================
-- Segments, addresses, and what a refund did to lifetime value
-- ----------------------------------------------------------------------------
-- 20251101002500 gave a buyer an identity and derived their stats. What it did
-- not give them was any way to be grouped. "Wholesale buyers", "people who
-- have abandoned a delivery", "the Abuja regulars" are the categories this
-- shop actually thinks in, and none of them could be written down -- so the
-- targeted message goes out by hand, to whoever the owner remembers.
--
-- WHY AN ARRAY AND NOT A JOIN TABLE
--
-- A customer_tags table would be the textbook answer and would be worse here.
-- Tags are read on every row of the customer list and written one customer at
-- a time by a human; there is no tag entity with attributes of its own, no
-- rename to cascade, and the whole vocabulary of a shop this size is a couple
-- of dozen strings. A GIN-indexed array answers "who is tagged wholesale" in
-- one index scan with no join, and the tag list itself is a DISTINCT over the
-- same column.
--
-- Normalisation is a trigger rather than a CHECK. A CHECK can only refuse
-- "Wholesale" for not being "wholesale", which turns a typo into a failed
-- save; the trigger makes it right instead. Casing, padding and duplicates are
-- not decisions anybody meant to make.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Segment tags
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.customers.tags IS
  'Free-vocabulary segment labels, normalised to lowercase and deduplicated by trigger. Filter with the && / @> array operators, which customers_tags_idx serves.';

-- Answers "everyone tagged X" without a sequential scan.
CREATE INDEX IF NOT EXISTS customers_tags_idx
  ON public.customers USING gin (tags);

CREATE OR REPLACE FUNCTION public.normalise_customer_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.tags IS NULL THEN
    NEW.tags := '{}';
    RETURN NEW;
  END IF;

  -- Lowercase, trimmed, blanks dropped, duplicates collapsed, ordered so two
  -- customers tagged the same way compare equal. Capped at 20: past that it is
  -- not a segment, it is a note.
  SELECT COALESCE(array_agg(tag ORDER BY tag), '{}')
    INTO NEW.tags
    FROM (
      SELECT DISTINCT lower(btrim(t)) AS tag
        FROM unnest(NEW.tags) AS t
       WHERE btrim(COALESCE(t, '')) <> ''
       LIMIT 20
    ) AS cleaned;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS customers_normalise_tags ON public.customers;

CREATE TRIGGER customers_normalise_tags
  BEFORE INSERT OR UPDATE OF tags ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.normalise_customer_tags();

-- ---------------------------------------------------------------------------
-- 2. Addresses this buyer has actually used
-- ---------------------------------------------------------------------------
-- Derived from orders rather than stored on the customer, for the same reason
-- customer_stats is derived: an address book maintained beside the orders it
-- came from is an address book that drifts from them. What the shop wants to
-- know is "where have we sent this person's parcels", and that question has
-- exactly one honest source.
CREATE OR REPLACE VIEW public.customer_addresses
WITH (security_invoker = true) AS
SELECT
  o.customer_id,
  o.delivery_address,
  o.city,
  o.selected_state,
  o.selected_lga,
  count(*)          AS times_used,
  max(o.created_at) AS last_used_at
FROM public.orders o
WHERE o.customer_id IS NOT NULL
  AND btrim(COALESCE(o.delivery_address, '')) <> ''
GROUP BY o.customer_id, o.delivery_address, o.city, o.selected_state, o.selected_lga;

COMMENT ON VIEW public.customer_addresses IS
  'Distinct delivery addresses per customer, with how often each was used, derived from orders on read.';

REVOKE ALL ON public.customer_addresses FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. customer_stats learns about tags and refunds
-- ---------------------------------------------------------------------------
-- Appended, never reshaped: CREATE OR REPLACE VIEW may add columns to the end
-- of the list and may not change the ones already there. lifetime_value keeps
-- its exact definition and its bigint type for that reason -- the net figure
-- arrives beside it as a new column rather than by quietly redefining a number
-- other code already reads.
--
-- The distinction is worth having on screen. Gross lifetime value is what this
-- buyer has ever agreed to pay and is the right basis for "our best
-- customers"; net is what the shop kept, and a buyer who orders constantly and
-- sends half of it back is a very different person from one who does not.
CREATE OR REPLACE VIEW public.customer_stats
WITH (security_invoker = true) AS
SELECT
  c.id AS customer_id,
  c.email,
  c.full_name,
  c.phone_e164,
  c.is_blocked,
  count(o.id)                                             AS orders_total,
  count(o.id) FILTER (WHERE o.status NOT IN ('pending', 'cancelled'))  AS orders_revenue,
  count(o.id) FILTER (WHERE o.status = 'cancelled')       AS orders_cancelled,
  COALESCE(sum(o.total_amount) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS lifetime_value,
  min(o.created_at)                                       AS first_order_at,
  max(o.created_at)                                       AS last_order_at,
  c.tags,
  COALESCE(sum(o.amount_refunded) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS lifetime_refunded,
  COALESCE(sum(o.total_amount - o.amount_refunded) FILTER (WHERE o.status NOT IN ('pending', 'cancelled')), 0) AS net_lifetime_value
FROM public.customers c
LEFT JOIN public.orders o ON o.customer_id = c.id
GROUP BY c.id, c.email, c.full_name, c.phone_e164, c.is_blocked, c.tags;

COMMENT ON VIEW public.customer_stats IS
  'Per-customer order counts, lifetime value gross and net of refunds, and segment tags. Derived from orders on read so nothing drifts.';

REVOKE ALL ON public.customer_stats FROM anon, authenticated;
