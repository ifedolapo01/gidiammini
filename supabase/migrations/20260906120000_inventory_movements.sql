-- ============================================================================
-- Every unit that moved, and why
-- ----------------------------------------------------------------------------
-- The Stock page can tell you a variant has 4 left. It cannot tell you whether
-- that 4 is on its way down from 40 in a fortnight or has been sitting there
-- since March, and those two 4s call for opposite decisions. Nothing in this
-- database records a stock *change* — only the current level — so sell-through,
-- days of cover, reorder points and dead stock are all unanswerable, and the
-- shop finds out it is out of a best-seller when a customer tells it.
--
-- This is the ledger those all read from. One row per change, forever.
--
-- WHY A TRIGGER AND NOT A WRITE IN EACH CALLER
--
-- Stock reaches product_variants.stock down five paths: a checkout claiming it
-- (adjust_order_stock), an order being cancelled or swept releasing it, the
-- Stock page saving a level (set_variant_stock), the product form rewriting a
-- variant set (replace_product_variants), and the occasional hand-run UPDATE.
-- A ledger that each of those has to remember to append to is a ledger with
-- holes in it, and a ledger with holes is worse than none: it invites
-- confident arithmetic over incomplete data. The trigger sits on the column
-- itself, so a movement is recorded because the stock moved, not because
-- somebody remembered.
--
-- WHY THE REASON COMES FROM A SETTING
--
-- A trigger can see that stock went from 6 to 4. It cannot see whether that
-- was a sale or a correction, and the difference is the entire point of the
-- table — velocity computed over admin corrections is a fiction. So the
-- functions that know set a transaction-local GUC and the trigger reads it.
-- They do it themselves rather than asking their callers to, because the
-- caller of adjust_order_stock is the one place that would forget.
--
-- Anything that changes stock without setting it lands as 'adjustment', which
-- is what a bare UPDATE by a person actually is.
--
-- NO BACKFILL IS POSSIBLE
--
-- There is no record of past movements to reconstruct one from: order_items
-- says what was sold but not when stock moved for it, and admin corrections
-- left no trace at all. So the ledger starts empty and every reading built on
-- it has to say how much history it has — see days_of_cover in
-- lib/commerce/inventory-analytics.ts, which reports its own window rather
-- than extrapolating from three days of data as if it were three months.
--
-- Over the 200-line limit, deliberately: two existing functions are dropped
-- and recreated, which means giving them in full, and splitting the trigger
-- from the functions that feed it would leave a migration that records every
-- movement as 'adjustment' if the second half were ever skipped.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  -- Denormalised from the variant. Every product-level question — what is
  -- selling, what is dead — would otherwise join through product_variants on
  -- every read, and the variant a movement belongs to cannot change.
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Signed: negative left the shelf, positive arrived on it. Never zero — the
  -- trigger only fires on an actual change, and a zero row would be noise that
  -- every average has to filter out.
  delta integer NOT NULL CHECK (delta <> 0),
  -- The level this movement left behind. Stored rather than derived so a
  -- stock-take can be reconciled against what the system believed at the time,
  -- and so reading a variant's history costs no running sum.
  stock_after integer NOT NULL,

  reason text NOT NULL DEFAULT 'adjustment' CHECK (reason IN (
    -- Stock claimed by a checkout. The only reason that counts as demand.
    'sale',
    -- Given back: an order cancelled, or a reservation swept.
    'release',
    -- New units arrived from a supplier.
    'restock',
    -- Somebody corrected the number. The default, because a bare UPDATE by a
    -- person is exactly that.
    'adjustment',
    -- A counted shelf reconciled against the system.
    'stock_take',
    -- The product form rewrote this variant's set.
    'variant_edit'
  )),

  -- What caused it, where there is something to point at. 'order' is the only
  -- kind so far; a purchase order becomes the second when reordering exists.
  reference_type text CHECK (reference_type IS NULL OR reference_type IN ('order')),
  reference_id   uuid,
  -- Free text, for the reasons a code cannot carry: "water damage", "found two
  -- behind the counter". The sentence a stock-take is worthless without.
  note text,
  -- auth.users.id of the admin, where one did it. Null for a checkout or a
  -- cron, which is a fact worth being able to see rather than a gap.
  actor_id uuid,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_movements IS
  'Append-only ledger of every change to product_variants.stock, written by the trigger below. The basis of sell-through, days of cover, reorder points and the aging report.';
COMMENT ON COLUMN public.inventory_movements.delta IS
  'Signed change in units. Negative left the shelf; only reason = ''sale'' counts as demand.';
COMMENT ON COLUMN public.inventory_movements.stock_after IS
  'The level immediately after this movement, so a stock-take can be reconciled against what the system believed.';

-- One variant's history, newest first: the variant drawer, and the per-size
-- sell-out analysis.
CREATE INDEX IF NOT EXISTS inventory_movements_variant_idx
  ON public.inventory_movements (variant_id, created_at DESC);

-- One product's history, and the aging report's "nothing since" question.
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx
  ON public.inventory_movements (product_id, created_at DESC);

-- Velocity. Every reorder-point and days-of-cover query is "sales in the last
-- N days", and they run over the whole catalogue at once — so the partial
-- index carries only the rows those queries can use, which on a shop whose
-- admin corrects stock daily is a fraction of the table.
CREATE INDEX IF NOT EXISTS inventory_movements_sales_idx
  ON public.inventory_movements (created_at DESC, variant_id)
  WHERE reason = 'sale';

-- "What did this order do to stock?" — asked from the order timeline.
CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx
  ON public.inventory_movements (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
-- No policies. RLS on with nothing granted means anon and authenticated can do
-- nothing; service_role bypasses RLS. Same shape as 20251101001700.

-- ---------------------------------------------------------------------------
-- The context a trigger cannot infer
-- ---------------------------------------------------------------------------
-- Transaction-local (the `true` third argument), so it cannot leak into the
-- next statement on a pooled connection — which for a ledger would mean
-- labelling somebody else's correction as a sale.
CREATE OR REPLACE FUNCTION public.set_inventory_context(
  p_reason         text,
  p_reference_type text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL,
  p_actor_id       uuid DEFAULT NULL,
  p_note           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.inv_reason',         COALESCE(p_reason, ''),                 true);
  PERFORM set_config('app.inv_reference_type', COALESCE(p_reference_type, ''),         true);
  PERFORM set_config('app.inv_reference_id',   COALESCE(p_reference_id::text, ''),     true);
  PERFORM set_config('app.inv_actor_id',       COALESCE(p_actor_id::text, ''),         true);
  PERFORM set_config('app.inv_note',           COALESCE(p_note, ''),                   true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_inventory_context(text, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_inventory_context(text, text, uuid, uuid, text) TO service_role;

/** Reads one of the settings above, or NULL when it was never set. */
CREATE OR REPLACE FUNCTION public.inventory_context(p_key text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(COALESCE(current_setting('app.inv_' || p_key, true), ''), '');
$$;

-- ---------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta  integer;
  v_reason text;
BEGIN
  v_delta := NEW.stock - COALESCE(OLD.stock, 0);

  -- IS DISTINCT FROM in the trigger's WHEN already rules out most of these;
  -- this catches an update that lands on the same number by a different route.
  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  v_reason := COALESCE(public.inventory_context('reason'), 'adjustment');

  -- A reason the CHECK would refuse must not take the UPDATE down with it: the
  -- stock change is the important half, and a mislabelled movement is a far
  -- smaller problem than a checkout that fails because somebody set a typo.
  IF v_reason NOT IN ('sale', 'release', 'restock', 'adjustment', 'stock_take', 'variant_edit') THEN
    RAISE WARNING 'Unknown inventory reason %, recording as adjustment', v_reason;
    v_reason := 'adjustment';
  END IF;

  INSERT INTO public.inventory_movements (
    variant_id, product_id, delta, stock_after,
    reason, reference_type, reference_id, actor_id, note
  ) VALUES (
    NEW.id,
    NEW.product_id,
    v_delta,
    NEW.stock,
    v_reason,
    public.inventory_context('reference_type'),
    public.inventory_context('reference_id')::uuid,
    public.inventory_context('actor_id')::uuid,
    public.inventory_context('note')
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_record_movement_trg ON public.product_variants;

-- AFTER, so a movement is only recorded once the change has actually survived
-- every other constraint on the row — including CHECK (stock >= 0).
CREATE TRIGGER product_variants_record_movement_trg
  AFTER UPDATE OF stock ON public.product_variants
  FOR EACH ROW
  WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION public.record_inventory_movement();

-- Deliberately no INSERT trigger. A new variant's opening stock is not a
-- movement — nothing moved, the shop is describing what it already has — and
-- recording it as a restock would put phantom arrivals into every velocity
-- window on the day somebody adds a colour.

-- ---------------------------------------------------------------------------
-- The two functions that know why stock moved now say so
-- ---------------------------------------------------------------------------
-- DROP then CREATE rather than CREATE OR REPLACE: both gain parameters, and
-- CREATE OR REPLACE with a new signature leaves the old arity in place as an
-- overload, which PostgREST would then refuse to resolve. The new parameters
-- all default, so every existing 2- and 3-argument call site -- including
-- edit_order_items(), which calls adjust_order_stock inline -- keeps working
-- untouched.

DROP FUNCTION IF EXISTS public.adjust_order_stock(JSONB, BOOLEAN);

CREATE FUNCTION public.adjust_order_stock(
  p_items        JSONB,
  p_reserve      BOOLEAN,
  -- The order this movement belongs to, so the ledger can answer "what did
  -- order UT00104221 do to stock". Optional, because the reservation sweep and
  -- edit_order_items both call this without one to hand.
  p_reference_id UUID DEFAULT NULL,
  p_actor_id     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     RECORD;
  v_delta   INTEGER;
  v_have    INTEGER;
  v_name    TEXT;
  v_size    TEXT;
  v_color   TEXT;
  v_label   TEXT;
  v_vid     UUID;
  v_touched INTEGER := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'products_touched', 0);
  END IF;

  -- Claiming stock is demand; giving it back is not. This is the distinction
  -- every velocity figure rests on, which is why it is set here rather than
  -- left to whichever route happened to make the call.
  PERFORM public.set_inventory_context(
    CASE WHEN p_reserve THEN 'sale' ELSE 'release' END,
    CASE WHEN p_reference_id IS NULL THEN NULL ELSE 'order' END,
    p_reference_id,
    p_actor_id,
    NULL
  );

  -- Aggregate duplicate (product, size, color) tuples first, so two separately
  -- affordable lines for one variant cannot both pass against a single unit.
  FOR v_row IN
    SELECT (i->>'product_id')::UUID AS product_id,
           public.variant_key(i->>'size', i->>'color') AS variant_key,
           SUM(COALESCE((i->>'quantity')::INTEGER, 0)) AS qty
      FROM jsonb_array_elements(p_items) AS i
     WHERE (i->>'product_id') IS NOT NULL
     GROUP BY 1, 2
     -- Deterministic order, so concurrent multi-item orders cannot deadlock by
     -- taking the same two rows in opposite orders.
     ORDER BY 1, 2
  LOOP
    IF v_row.qty = 0 THEN
      CONTINUE;
    END IF;

    v_delta := CASE WHEN p_reserve THEN -v_row.qty ELSE v_row.qty END;

    -- The lock. One row, held for the read and the write. FOR UPDATE OF v
    -- locks the variant row only -- the joined product row is read, not locked.
    SELECT v.id, v.stock, p.name, v.size, v.color
      INTO v_vid, v_have, v_name, v_size, v_color
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.product_id = v_row.product_id
       AND v.variant_key = v_row.variant_key
       FOR UPDATE OF v;

    -- FOUND, not `v_vid IS NULL`: the variables keep their values from the
    -- previous iteration when a SELECT INTO matches nothing.
    IF NOT FOUND THEN
      -- Under the old model an unrecognised selection quietly adjusted only the
      -- product total, which is what allowed a sale of something not for sale.
      -- Refuse it instead.
      RAISE EXCEPTION 'That item is no longer available in the selected size or colour.'
        USING ERRCODE = 'GM001';
    END IF;

    v_label := v_name || COALESCE(' (' || NULLIF(concat_ws(' / ', v_size, v_color), '') || ')', '');

    IF p_reserve AND COALESCE(v_have, 0) < v_row.qty THEN
      RAISE EXCEPTION 'Only % left of %.', GREATEST(COALESCE(v_have, 0), 0), v_label
        USING ERRCODE = 'GM001';
    END IF;

    -- The CHECK (stock >= 0) is the backstop if this is ever reached with a
    -- release larger than what was taken.
    UPDATE public.product_variants
       SET stock = stock + v_delta
     WHERE id = v_vid;

    v_touched := v_touched + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'products_touched', v_touched);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_order_stock(JSONB, BOOLEAN, UUID, UUID) TO service_role;

DROP FUNCTION IF EXISTS public.set_variant_stock(UUID, TEXT, INTEGER);

CREATE FUNCTION public.set_variant_stock(
  p_product_id  UUID,
  p_variant_key TEXT,
  p_new_stock   INTEGER,
  -- What kind of change this is. 'adjustment' is the honest default for a
  -- number somebody corrected; the Stock page passes 'restock' when units
  -- arrived and 'stock_take' when a shelf was counted, and the difference is
  -- what keeps a delivery out of the dead-stock report.
  p_reason      TEXT DEFAULT 'adjustment',
  p_note        TEXT DEFAULT NULL,
  p_actor_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  IF p_product_id IS NULL OR p_variant_key IS NULL OR p_variant_key = '' THEN
    RAISE EXCEPTION 'set_variant_stock requires a product id and a variant key' USING ERRCODE = 'GM003';
  END IF;

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative.' USING ERRCODE = 'GM003';
  END IF;

  IF p_reason NOT IN ('restock', 'adjustment', 'stock_take') THEN
    -- Narrower than the table's CHECK on purpose: 'sale' and 'release' belong
    -- to adjust_order_stock, and letting the Stock page claim either would put
    -- corrections into the demand figures.
    RAISE EXCEPTION 'A stock edit must be a restock, an adjustment or a stock take.' USING ERRCODE = 'GM003';
  END IF;

  PERFORM public.set_inventory_context(p_reason, NULL, NULL, p_actor_id, p_note);

  UPDATE public.product_variants
     SET stock = p_new_stock
   WHERE product_id = p_product_id
     AND variant_key = p_variant_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That variant no longer exists.' USING ERRCODE = 'GM003';
  END IF;

  SELECT stock INTO v_total FROM public.products WHERE id = p_product_id;

  RETURN jsonb_build_object('ok', true, 'variant_stock', p_new_stock, 'product_stock', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.set_variant_stock(UUID, TEXT, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_variant_stock(UUID, TEXT, INTEGER, TEXT, TEXT, UUID) TO service_role;
