-- ============================================================================
-- Server-issued order numbers, and idempotent order creation
-- ----------------------------------------------------------------------------
-- Two related problems, one migration.
--
-- 1. ORDER NUMBERS WERE MINTED IN THE BROWSER
--    app/checkout generated `UT${Date.now().toString().slice(-8)}`. Two
--    checkouts in the same millisecond produce the same string, and nothing
--    handled the resulting unique-constraint failure. A sequence removes the
--    possibility rather than handling the symptom.
--
--    The number cannot be generated at INSERT time, because the customer is
--    shown it before the order exists — components/checkout/BankDetails.tsx
--    tells them to use "Order #X" as their bank transfer remark. So it is
--    issued at the step-1 -> step-2 gate and reserved against the checkout's
--    idempotency key, which means a customer who goes back and resubmits keeps
--    the same number rather than being handed a new one after they may already
--    have initiated a transfer.
--
-- 2. A DROPPED RESPONSE MEANT A DUPLICATE ORDER
--    The checkout flow is: upload receipt -> insert order. If the insert
--    succeeded but the response never arrived, the customer retried and got a
--    second order against one payment — with stock claimed twice.
--
--    orders.idempotency_key makes the insert idempotent: a replay finds the
--    existing order and returns it.
--
-- SEQUENCE START: existing order numbers are timestamp-derived and sit between
-- UT10595593 and UT88478504. Starting at 100000 (UT00100000) cannot collide
-- with those, and won't for the next ~10 million orders. It also avoids
-- starting at 1, which would advertise the store's order count on every
-- receipt.
--
-- Safe to run more than once.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq AS BIGINT START WITH 100000 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- Reserved numbers, keyed by the checkout attempt that asked for one
-- ---------------------------------------------------------------------------
-- Kept rather than pruned: the row is the record that a number was issued, so
-- it can never be handed out twice even if the sequence were ever reset. At a
-- few hundred bytes each this costs nothing.
CREATE TABLE IF NOT EXISTS public.order_number_reservations (
  idempotency_key UUID PRIMARY KEY,
  order_number    TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_number_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_number_reservations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- orders.idempotency_key
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- Partial, so the rows that predate this migration (all NULL) don't sit in the
-- index at all.
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.idempotency_key IS
  'One value per checkout attempt, minted by the browser. Makes order creation idempotent: a retry after a dropped response returns the existing order instead of creating a second one. NULL on orders created before this was introduced.';

-- ---------------------------------------------------------------------------
-- reserve_order_number — issue a number, or return the one already issued
-- ---------------------------------------------------------------------------
-- Idempotent by design: calling it repeatedly with the same key always returns
-- the same number and consumes no further sequence values beyond the first
-- attempt.
--
-- The INSERT is attempted first and the SELECT only runs on conflict, so two
-- concurrent callers with the same key cannot both take a number.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_order_number(p_idempotency_key UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'reserve_order_number requires an idempotency key';
  END IF;

  SELECT r.order_number INTO v_order_number
    FROM public.order_number_reservations r
   WHERE r.idempotency_key = p_idempotency_key;

  IF v_order_number IS NOT NULL THEN
    RETURN v_order_number;
  END IF;

  INSERT INTO public.order_number_reservations (idempotency_key, order_number)
  VALUES (p_idempotency_key, 'UT' || LPAD(nextval('public.order_number_seq')::TEXT, 8, '0'))
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING order_number INTO v_order_number;

  IF v_order_number IS NULL THEN
    -- Lost the race to a concurrent caller with the same key; use theirs.
    SELECT r.order_number INTO v_order_number
      FROM public.order_number_reservations r
     WHERE r.idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_order_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_order_number(UUID) TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_number_seq TO service_role;
