-- ============================================================================
-- Codes, limits, and what a discount actually earned
-- ----------------------------------------------------------------------------
-- The discount engine targets well -- sitewide down to a single variant -- and
-- has exactly one way of applying: automatically, to everybody, forever. There
-- is no way to run an influencer code, a win-back code, a first-order code, or
-- "spend 20,000 and delivery is free". And after a sale ends nothing anywhere
-- says whether it made money or simply discounted sales that would have
-- happened anyway.
--
-- Four things, one migration, because they are one feature.
--
-- 1. A CODE MAKES A DISCOUNT OPT-IN
--
-- No `requires_code` flag. A discount with a code is entered by the customer
-- and applies to nobody else; a discount with no code applies automatically as
-- it does today. Deriving that from `code IS NOT NULL` rather than storing it
-- separately means the two can never disagree -- there is no state where a
-- discount has a code and also silently applies to everyone.
--
-- Stored uppercase with a case-insensitive unique index, because a customer
-- typing "welcome10" into a form has entered WELCOME10 and being told
-- otherwise is the shop's fault.
--
-- 2. LIMITS ARE NULL FOR UNLIMITED
--
-- max_redemptions and per_customer_limit are nullable, and null means no
-- ceiling. Zero would be the other candidate and is a worse one: it reads as
-- "nobody may use this", which is a state somebody will set by accident.
--
-- 3. FREE_SHIPPING IS A DIFFERENT KIND OF DISCOUNT
--
-- PERCENTAGE and FIXED come off a line's price. FREE_SHIPPING comes off the
-- delivery fee, which is not a line at all -- so it cannot be run through the
-- same per-item comparison, and lib/commerce/discounts.ts excludes it from
-- getBestDiscount() rather than letting `value` be subtracted from a garment's
-- price. Its `value` column is unused and constrained to 0 so nobody reads
-- meaning into it.
--
-- 4. A REDEMPTION IS A ROW
--
-- discount_redemptions is what makes any of the reporting possible. Until now
-- priceOrder() worked out which discount applied to each line and then threw
-- that away: order_items had nowhere to record it. So "what did the Easter
-- sale earn" has never been answerable, for automatic discounts either -- which
-- is why order_items.discount_id is added here too, not only the redemptions
-- table. The table answers "who used this code and how often"; the column
-- answers "what did this discount cost us across every order".
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.discounts
  -- NULL means the discount applies automatically, as every existing row does.
  ADD COLUMN IF NOT EXISTS code text,
  -- Total uses across all customers. NULL for unlimited.
  ADD COLUMN IF NOT EXISTS max_redemptions integer,
  -- Uses per customer, matched on email. NULL for unlimited.
  ADD COLUMN IF NOT EXISTS per_customer_limit integer,
  -- Minimum items subtotal, in whole naira, before this applies at all.
  ADD COLUMN IF NOT EXISTS min_order_value integer NOT NULL DEFAULT 0,
  -- Maintained by the trigger below rather than counted on every read: the
  -- checkout has to check the ceiling before it can price an order, and a
  -- COUNT(*) over a growing table on the critical path of every code entry is
  -- a cost that only goes up.
  ADD COLUMN IF NOT EXISTS redemption_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.discounts.code IS
  'Uppercase redemption code. NULL means the discount applies automatically to everyone, which is how every discount behaved before this migration.';
COMMENT ON COLUMN public.discounts.max_redemptions IS
  'Total uses allowed. NULL means unlimited -- not 0, which reads as "nobody may use this".';
COMMENT ON COLUMN public.discounts.redemption_count IS
  'Maintained by the trigger on discount_redemptions. Denormalised so the checkout can check the ceiling without counting rows.';

DO $codes$
BEGIN
  -- Uppercase, no spaces, long enough to be read down a phone line.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'discounts_code_shape' AND conrelid = 'public.discounts'::regclass
  ) THEN
    ALTER TABLE public.discounts ADD CONSTRAINT discounts_code_shape
      CHECK (code IS NULL OR code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'discounts_limits_positive' AND conrelid = 'public.discounts'::regclass
  ) THEN
    ALTER TABLE public.discounts ADD CONSTRAINT discounts_limits_positive
      CHECK (
        (max_redemptions    IS NULL OR max_redemptions    > 0) AND
        (per_customer_limit IS NULL OR per_customer_limit > 0) AND
        min_order_value  >= 0 AND
        redemption_count >= 0
      );
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'discount code constraints not added: existing rows violate them.';
END $codes$;

-- One code, however it was typed.
CREATE UNIQUE INDEX IF NOT EXISTS discounts_code_unique_idx
  ON public.discounts (upper(code))
  WHERE code IS NOT NULL;

-- FREE_SHIPPING joins the type vocabulary. Its `value` is meaningless -- the
-- amount waived is whatever the zone charges -- so it is pinned to 0 rather
-- than left as a number somebody will later try to interpret.
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_type_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_type_check
  CHECK (type IN ('PERCENTAGE', 'FIXED', 'FREE_SHIPPING'));

DO $freeship$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'discounts_free_shipping_value' AND conrelid = 'public.discounts'::regclass
  ) THEN
    ALTER TABLE public.discounts ADD CONSTRAINT discounts_free_shipping_value
      CHECK (type <> 'FREE_SHIPPING' OR value = 0);
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'discounts_free_shipping_value not added: existing rows violate it.';
END $freeship$;

-- ---------------------------------------------------------------------------
-- Which discount priced each line
-- ---------------------------------------------------------------------------
-- priceOrder() has always computed this and persist-order.ts has always
-- dropped it. Without the column, attributed revenue can only ever be reported
-- for code discounts -- and the automatic ones are the ones this shop actually
-- runs.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_id uuid REFERENCES public.discounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.order_items.discount_id IS
  'The discount that produced this line''s price. Null when it sold at catalogue price. ON DELETE SET NULL: deleting a discount must not delete order history.';

CREATE INDEX IF NOT EXISTS order_items_discount_idx
  ON public.order_items (discount_id)
  WHERE discount_id IS NOT NULL;

-- What the line would have cost without a discount.
--
-- Without this, "what did this sale cost us" is only answerable for codes,
-- because discount_redemptions.amount_saved records it and order_items records
-- only the price charged. Reversing a percentage out of the charged price is
-- not a substitute: the discount's own `value` can be edited after the fact,
-- so the arithmetic would restate history every time somebody adjusts a
-- campaign.
--
-- Nullable, because every row that predates this migration genuinely does not
-- know. Reports say "not recorded" for those rather than assuming no discount
-- was given, which would understate what past sales cost.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_price integer;

COMMENT ON COLUMN public.order_items.base_price IS
  'Catalogue price per unit before any discount. Null for rows created before 20260906150000 — unknown, not zero.';

-- ---------------------------------------------------------------------------
-- Redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Lower-cased at write time. The per-customer limit is enforced against this
  -- rather than customer_id, because a guest checkout has no customer row
  -- until the order lands and a code limited to one use per person must hold
  -- for people who have never signed in.
  email text NOT NULL,

  -- What the customer saved, in whole naira. Stored rather than recomputed:
  -- the discount's own value can be edited afterwards, and a report that
  -- restates history every time somebody adjusts a percentage is a report
  -- nobody can reconcile against a bank statement.
  amount_saved integer NOT NULL DEFAULT 0 CHECK (amount_saved >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- One redemption per discount per order. The ceiling checks are advisory --
  -- read, then written a moment later -- so this is the constraint that
  -- actually holds under two concurrent checkouts with the same code.
  UNIQUE (discount_id, order_id)
);

COMMENT ON TABLE public.discount_redemptions IS
  'One row per discount used on an order. The basis of redemption counts, per-customer limits and attributed revenue.';

CREATE INDEX IF NOT EXISTS discount_redemptions_discount_idx
  ON public.discount_redemptions (discount_id, created_at DESC);

-- The per-customer limit check, which runs on every code entry.
CREATE INDEX IF NOT EXISTS discount_redemptions_email_idx
  ON public.discount_redemptions (discount_id, email);

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_redemptions FROM anon, authenticated;
-- No policies. Same shape as every other locked table in 20251101001700.

-- ---------------------------------------------------------------------------
-- Keeping redemption_count true
-- ---------------------------------------------------------------------------
-- A trigger rather than an application-side increment: a redemption inserted
-- by a backfill, a correction, or a future admin tool has to move the counter
-- too, and code that has to remember is code that eventually does not.
CREATE OR REPLACE FUNCTION public.sync_discount_redemption_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discounts
       SET redemption_count = redemption_count + 1
     WHERE id = NEW.discount_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- GREATEST, so a counter that has somehow drifted low cannot go negative
    -- and trip the CHECK on an unrelated delete.
    UPDATE public.discounts
       SET redemption_count = GREATEST(redemption_count - 1, 0)
     WHERE id = OLD.discount_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS discount_redemptions_count_trg ON public.discount_redemptions;

CREATE TRIGGER discount_redemptions_count_trg
  AFTER INSERT OR DELETE ON public.discount_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_discount_redemption_count();

-- True up anything already there, so a re-run of this file leaves the counters
-- correct rather than merely unchanged.
UPDATE public.discounts d
   SET redemption_count = COALESCE(r.uses, 0)
  FROM (
    SELECT discount_id, COUNT(*) AS uses
      FROM public.discount_redemptions
     GROUP BY discount_id
  ) r
 WHERE r.discount_id = d.id
   AND d.redemption_count <> COALESCE(r.uses, 0);
