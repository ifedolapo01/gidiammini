-- ============================================================================
-- edit_order_items() -- an order's contents stop being immutable
-- ----------------------------------------------------------------------------
-- Line items were write-once: whatever the checkout inserted was what the
-- order said forever. Real orders do not behave that way. A customer adds a
-- second item over WhatsApp; a colour is out of stock so it is swapped; a
-- quantity was wrong. All of that already happens -- it just happens outside
-- the system, which then stops describing what is actually being shipped.
--
-- WHY THIS IS ONE FUNCTION AND NOT FIVE STATEMENTS IN TYPESCRIPT
--
-- An edit is four writes that have to succeed together: release the stock the
-- old lines held, claim the stock the new lines need, replace the lines, and
-- recompute the total. The Supabase JS client cannot open a transaction across
-- statements, so doing this from the application means a failure half way
-- leaves an order whose lines, stock and total disagree -- and the failure
-- mode that matters most, an oversell on the claim, is exactly the one that
-- happens after the release has already given the units back.
--
-- Inside one function it is one transaction. An oversell raises GM001 out of
-- adjust_order_stock and Postgres unwinds the release with it, so a refused
-- edit changes nothing at all.
--
-- RELEASE BEFORE CLAIM
--
-- The two calls are not netted per variant, they are run in order: give back
-- everything the order held, then take what it now needs. Netting would be
-- fewer row updates and would also make "change quantity from 3 to 4 on the
-- last 3 units" fail, because the claim would be checked against stock that
-- still counted this same order's own hold.
--
-- TAX RATE IS AN ARGUMENT
--
-- TAX_RATE lives in lib/commerce/checkout.ts and is what priceOrder() charged
-- at checkout. Hardcoding 0.075 here would be a second copy free to drift from
-- it, so the caller passes the rate it used and this function only does the
-- arithmetic -- the same division of labour as normalise_ng_msisdn(), where
-- the TypeScript is authoritative and the SQL mirrors it.
--
-- Safe to run more than once.
-- ============================================================================

-- p_items: [{ "product_id": uuid|null, "product_name": text, "price": int,
--             "quantity": int, "size": text|null, "color": text|null }, ...]
--
--   product_id may be null. Such a line is money but not inventory -- the
--   escape hatch for an existing line whose product has since been deleted,
--   which would otherwise make the order uneditable forever.
--
-- p_discount / p_discount_reason: NULL leaves the order's current manual
--   discount alone. Pass 0 to clear one.
--
-- Raises GM003 for anything the caller got wrong, GM001 for an oversell.
CREATE OR REPLACE FUNCTION public.edit_order_items(
  p_order_id        uuid,
  p_items           jsonb,
  p_tax_rate        numeric,
  p_discount        integer DEFAULT NULL,
  p_discount_reason text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order      public.orders%ROWTYPE;
  v_old_items  jsonb;
  v_item       jsonb;
  v_quantity   integer;
  v_price      integer;
  v_subtotal   integer := 0;
  v_tax        integer;
  v_discount   integer;
  v_reason     text;
  v_total      integer;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'An order id is required.' USING ERRCODE = 'GM003';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'An order must keep at least one line. Cancel it instead of emptying it.'
      USING ERRCODE = 'GM003';
  END IF;

  IF p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 1 THEN
    RAISE EXCEPTION 'The tax rate must be a fraction between 0 and 1.' USING ERRCODE = 'GM003';
  END IF;

  -- Lock the order for the duration. Two admins editing the same order at once
  -- serialise here rather than each computing a total from a snapshot the
  -- other has already replaced.
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'GM003';
  END IF;

  -- A finished order is a record of what happened, not a draft. Editing one
  -- would change an invoice already in somebody's hands and move stock that
  -- physically left the building.
  IF v_order.status IN ('cancelled', 'delivered', 'picked_up') THEN
    RAISE EXCEPTION 'This order is % and can no longer be edited.', v_order.status
      USING ERRCODE = 'GM003';
  END IF;

  -- Validate every line before touching anything, so a bad quantity on the
  -- last line does not leave the first ones already applied.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(btrim(v_item->>'product_name'), '') = '' THEN
      RAISE EXCEPTION 'Every line needs a product name.' USING ERRCODE = 'GM003';
    END IF;

    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 999 THEN
      RAISE EXCEPTION 'Quantity for "%" must be between 1 and 999.', v_item->>'product_name'
        USING ERRCODE = 'GM003';
    END IF;

    v_price := (v_item->>'price')::integer;
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Price for "%" cannot be negative.', v_item->>'product_name'
        USING ERRCODE = 'GM003';
    END IF;

    v_subtotal := v_subtotal + (v_price * v_quantity);
  END LOOP;

  -- Only orders actually holding inventory move any. A 'pending' order created
  -- before the reservation migration holds none, and releasing what was never
  -- claimed would invent stock.
  IF v_order.stock_reserved THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'product_id', i.product_id,
             'size',       i.size,
             'color',      i.color,
             'quantity',   i.quantity
           )), '[]'::jsonb)
      INTO v_old_items
      FROM public.order_items i
     WHERE i.order_id = p_order_id;

    PERFORM public.adjust_order_stock(v_old_items, false);
    PERFORM public.adjust_order_stock(p_items, true);
  END IF;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity, size, color)
  SELECT p_order_id,
         NULLIF(value->>'product_id', '')::uuid,
         btrim(value->>'product_name'),
         (value->>'price')::integer,
         (value->>'quantity')::integer,
         NULLIF(btrim(COALESCE(value->>'size', '')), ''),
         NULLIF(btrim(COALESCE(value->>'color', '')), '')
    FROM jsonb_array_elements(p_items);

  -- The delivery fee is deliberately untouched: what is in the box does not
  -- change what the courier charges, and re-quoting the zone here would
  -- silently reprice a delivery the customer already agreed to.
  v_tax      := round(v_subtotal * p_tax_rate)::integer;
  v_discount := COALESCE(p_discount, v_order.discount_amount);
  v_reason   := CASE WHEN p_discount IS NULL THEN v_order.discount_reason
                     WHEN p_discount = 0     THEN NULL
                     ELSE COALESCE(NULLIF(btrim(p_discount_reason), ''), v_order.discount_reason)
                END;

  IF v_discount < 0 THEN
    RAISE EXCEPTION 'A discount cannot be negative.' USING ERRCODE = 'GM003';
  END IF;

  IF v_discount > v_subtotal + v_tax + v_order.shipping_amount THEN
    RAISE EXCEPTION 'A discount of % is more than the order is worth.', v_discount
      USING ERRCODE = 'GM003';
  END IF;

  v_total := v_subtotal + v_tax + v_order.shipping_amount - v_discount;

  UPDATE public.orders
     SET items_subtotal  = v_subtotal,
         tax_amount      = v_tax,
         discount_amount = v_discount,
         discount_reason = v_reason,
         total_amount    = v_total,
         updated_at      = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'items_subtotal',  v_subtotal,
    'tax_amount',      v_tax,
    'shipping_amount', v_order.shipping_amount,
    'discount_amount', v_discount,
    'discount_reason', v_reason,
    'total_amount',    v_total,
    'previous_total',  v_order.total_amount,
    'stock_adjusted',  v_order.stock_reserved
  );
END;
$fn$;

COMMENT ON FUNCTION public.edit_order_items(uuid, jsonb, numeric, integer, text) IS
  'Replaces an order''s lines, moves the stock difference and recomputes the total in one transaction. Raises GM003 for bad input and GM001 for an oversell.';

-- Nothing in a browser may call this. Every caller is the server-side
-- service-role client, which is not one of these roles.
REVOKE ALL ON FUNCTION public.edit_order_items(uuid, jsonb, numeric, integer, text) FROM anon, authenticated;
