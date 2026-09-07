-- ============================================================================
-- Five more things a customer can ask for on their own order
-- ----------------------------------------------------------------------------
-- The change-request pattern (customer proposes, seller approves, the same
-- commerce function executes) only ever covered reschedule, a delivery-method
-- switch, and cancel. Everything else — a wrong address, a size that turned
-- out wrong, wanting one more item before it ships, a return once it has
-- arrived, asking to hold it a few days — went to WhatsApp instead.
--
-- Shapes, by request_type (mirrors types/orderChangeRequest.ts):
--   address_correction -> { "newAddress": string, "city"?: string }
--   item_swap           -> { "productId": uuid, "newSize"?: string, "newColor"?: string }
--                          -- productId must already be on the order; the new
--                          -- size/color is free text, resolved and validated
--                          -- against real stock when approved, same as
--                          -- reschedule's preferredDate is free text today.
--   add_item             -> { "productId": uuid, "size"?: string, "color"?: string, "quantity": number }
--                          -- productId must already be on the order -- this
--                          -- adds another line of something already bought,
--                          -- not a pick from the whole catalogue.
--   return_request        -> { "orderItemIds": uuid[], "reason": string }
--   hold_until            -> { "holdUntilDate": string }
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.order_change_requests DROP CONSTRAINT IF EXISTS order_change_requests_request_type_check;

ALTER TABLE public.order_change_requests
  ADD CONSTRAINT order_change_requests_request_type_check
  CHECK (request_type IN (
    'reschedule', 'delivery_method_change', 'cancel',
    'address_correction', 'item_swap', 'add_item', 'return_request', 'hold_until'
  ));
