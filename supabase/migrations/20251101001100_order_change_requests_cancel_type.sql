-- Allows customers to submit a 'cancel' request through the same
-- order_change_requests flow already used for reschedule/delivery-method
-- changes (see create-order-change-requests.sql), so cancellation still
-- needs the seller's explicit approval before it takes effect.

ALTER TABLE public.order_change_requests DROP CONSTRAINT IF EXISTS order_change_requests_request_type_check;

ALTER TABLE public.order_change_requests
  ADD CONSTRAINT order_change_requests_request_type_check
  CHECK (request_type IN ('reschedule', 'delivery_method_change', 'cancel'));
