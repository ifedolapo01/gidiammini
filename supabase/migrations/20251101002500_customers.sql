-- ============================================================================
-- customers: give a buyer an identity that survives across orders
-- ----------------------------------------------------------------------------
-- Until now a customer existed only as three denormalised strings on each
-- order (customer_name, customer_email, customer_phone). With no entity there
-- is no identity, so the store cannot answer "who buys here repeatedly", "what
-- has this person spent", or "who bought this and might want the restock".
--
-- IDENTITY KEY — email, not email+phone.
--
--   Checkout requires name, email and phone (lib/commerce/create-order.ts), so
--   email is always present and is the natural key. Phone is stored and
--   indexed for lookup but is deliberately NOT unique, because the live data
--   already disproves that assumption: phone 09068830372 appears on orders for
--   two different email addresses. A unique constraint spanning both columns
--   would either split one person into two rows whenever they retyped their
--   number differently, or refuse the second person's order outright.
--
-- SNAPSHOT vs IDENTITY.
--
--   orders.customer_name/email/phone stay exactly as they are, untouched. They
--   are the immutable record of what was typed at that checkout — the address
--   a receipt went to, the name on the parcel. The customers row is the
--   current, mutable identity. Conflating the two would let a later profile
--   edit rewrite the history of an order that already shipped.
--
-- STATS ARE A VIEW, NOT COLUMNS.
--
--   No orders_count / total_spent columns. This project has already been bitten
--   by a denormalised counter drifting from its source (products.stock, fixed
--   in 20251101001600). customer_stats derives everything from orders on read,
--   so it cannot go stale, and at this scale the aggregate is free.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  -- gen_random_uuid(), not uuid_generate_v4(). The latter comes from uuid-ossp,
  -- which hosted Supabase installs into the `extensions` schema — so the bare
  -- name does not resolve from the search_path `db push` runs with, and this
  -- statement fails there while working on a local rebuild (where the
  -- baseline's CREATE EXTENSION puts it in public). gen_random_uuid() is core
  -- Postgres since 13 and needs no extension; it is what every other migration
  -- in this folder already uses.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lower-cased and trimmed by the application before it gets here; the
  -- constraint below refuses anything else so a stray mixed-case value cannot
  -- create a second identity for the same person.
  email text NOT NULL,

  -- Canonical MSISDN (2348096539067) where the number could be parsed, else
  -- NULL. Kept beside the raw value rather than replacing it, so a number we
  -- cannot parse today is not lost.
  phone_e164 text,
  phone_raw text,

  -- Most recent name given at checkout. Display only; the per-order snapshot
  -- is what appears on that order.
  full_name text,

  -- Operational flags the string columns could never carry.
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customers_email_normalised CHECK (email = lower(btrim(email))),
  CONSTRAINT customers_email_not_blank CHECK (btrim(email) <> '')
);

-- The identity constraint. A partial index is not needed: email is NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key
  ON public.customers (email);

-- Deliberately non-unique — see the header. Supports "which customer is this
-- number", which is how the store recognises someone who calls or WhatsApps.
CREATE INDEX IF NOT EXISTS customers_phone_e164_idx
  ON public.customers (phone_e164)
  WHERE phone_e164 IS NOT NULL;

COMMENT ON TABLE public.customers IS
  'Buyer identity across orders, keyed on normalised email. Order rows keep their own name/email/phone as an immutable checkout snapshot.';

-- ---------------------------------------------------------------------------
-- 2. Link orders to it
-- ---------------------------------------------------------------------------
-- Nullable on purpose. Creating an order must never fail because customer
-- bookkeeping did, so the application sets this best-effort and logs loudly if
-- it could not. ON DELETE SET NULL for the same reason: removing a customer
-- record (a GDPR-style erasure request) must not delete their order history,
-- which the business needs for accounting.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES public.customers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_customer_id_idx
  ON public.orders (customer_id)
  WHERE customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Phone normalisation, mirroring lib/notifications/phone.ts
-- ---------------------------------------------------------------------------
-- Needed only so the backfill below can populate phone_e164 for orders that
-- predate this migration. Going forward the application normalises with the
-- TypeScript version, which is the tested one. The two must agree, so this
-- deliberately implements the same rules and nothing more: strip separators,
-- accept 00234 / 234 / 0 / bare prefixes, require a known mobile code.
CREATE OR REPLACE FUNCTION public.normalise_ng_msisdn(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits   text;
  v_national text;
BEGIN
  IF p_input IS NULL OR btrim(p_input) = '' THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_input, '[\s\-().+]', '', 'g');

  IF v_digits !~ '^\d+$' THEN
    RETURN NULL;
  END IF;

  IF v_digits LIKE '00234%' THEN
    v_national := substring(v_digits from 6);
  ELSIF v_digits LIKE '234%' THEN
    v_national := substring(v_digits from 4);
  ELSIF v_digits LIKE '0%' THEN
    v_national := substring(v_digits from 2);
  ELSE
    v_national := v_digits;
  END IF;

  -- A Nigerian mobile subscriber number is exactly 10 digits after the code.
  IF length(v_national) <> 10 THEN
    RETURN NULL;
  END IF;

  IF substring(v_national from 1 for 3) NOT IN (
    '701','702','703','704','705','706','707','708','709',
    '801','802','803','804','805','806','807','808','809',
    '810','811','812','813','814','815','816','817','818','819',
    '901','902','903','904','905','906','907','908','909',
    '911','912','913','915','916','917','918'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN '234' || v_national;
END;
$$;

COMMENT ON FUNCTION public.normalise_ng_msisdn(text) IS
  'Backfill-only mirror of normalisePhone() in lib/notifications/phone.ts. The application uses the TypeScript version.';

-- ---------------------------------------------------------------------------
-- 4. Backfill: one customer per distinct normalised email
-- ---------------------------------------------------------------------------
-- Idempotent via ON CONFLICT, so a re-run refreshes the derived fields rather
-- than duplicating or failing. Orders with no email cannot be attributed to an
-- identity and are left with customer_id NULL.
--
-- DISTINCT ON picks the most recent order per email, so the name and phone
-- carried onto the customer are the latest the buyer gave us.
INSERT INTO public.customers (email, full_name, phone_raw, phone_e164, created_at, updated_at)
SELECT
  latest.email,
  latest.customer_name,
  latest.customer_phone,
  public.normalise_ng_msisdn(latest.customer_phone),
  latest.first_order_at,
  now()
FROM (
  SELECT DISTINCT ON (lower(btrim(o.customer_email)))
    lower(btrim(o.customer_email)) AS email,
    o.customer_name,
    o.customer_phone,
    MIN(o.created_at) OVER (PARTITION BY lower(btrim(o.customer_email))) AS first_order_at
  FROM public.orders o
  WHERE btrim(coalesce(o.customer_email, '')) <> ''
  ORDER BY lower(btrim(o.customer_email)), o.created_at DESC
) AS latest
ON CONFLICT (email) DO UPDATE
  SET full_name  = COALESCE(EXCLUDED.full_name, public.customers.full_name),
      phone_raw  = COALESCE(EXCLUDED.phone_raw, public.customers.phone_raw),
      phone_e164 = COALESCE(EXCLUDED.phone_e164, public.customers.phone_e164),
      updated_at = now();

-- Attach every order that has an email to its customer.
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE c.email = lower(btrim(coalesce(o.customer_email, '')))
  AND o.customer_id IS DISTINCT FROM c.id;

-- ---------------------------------------------------------------------------
-- 5. Keep updated_at honest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_touch_updated_at ON public.customers;
CREATE TRIGGER customers_touch_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_customers_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Derived stats — computed on read, so they cannot drift
-- ---------------------------------------------------------------------------
-- Revenue counts every status except 'pending' (not yet confirmed) and
-- 'cancelled' (never fulfilled), matching REVENUE_STATUSES in
-- lib/commerce/order-status.ts. Order counts are reported both ways, because
-- "how many times has this person ordered" and "how much have they actually
-- paid us" are different questions.
-- security_invoker is load-bearing. A Postgres view runs with its *owner's*
-- privileges by default, so a view owned by postgres over two RLS-protected
-- tables becomes a hole straight through that protection for anyone who can
-- select from it. The REVOKE below closes today's grants, but Supabase's
-- default privileges hand new objects to anon in some configurations, and a
-- later GRANT would silently re-open it. With security_invoker the view is
-- evaluated as the querying role, so customers' and orders' own policies
-- still apply and the REVOKE is a second line rather than the only one.
-- Requires PostgreSQL 15+; this database is 17.
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
  max(o.created_at)                                       AS last_order_at
FROM public.customers c
LEFT JOIN public.orders o ON o.customer_id = c.id
GROUP BY c.id, c.email, c.full_name, c.phone_e164, c.is_blocked;

COMMENT ON VIEW public.customer_stats IS
  'Per-customer order counts and lifetime value, derived from orders on read so they never drift.';

-- ---------------------------------------------------------------------------
-- 7. Lock it down, matching 20251101001700
-- ---------------------------------------------------------------------------
-- This table holds more personal data than orders did, and nothing in the
-- browser reads it — every access is server-side through the service-role
-- client, which bypasses RLS. RLS on with no policies means anon and
-- authenticated can do nothing.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.customers', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.customers     FROM anon, authenticated;
REVOKE ALL ON public.customer_stats FROM anon, authenticated;
