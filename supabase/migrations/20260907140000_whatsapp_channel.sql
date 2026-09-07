-- ============================================================================
-- WhatsApp as a notification channel
-- ----------------------------------------------------------------------------
-- Widens notifications.channel (20260906140000) to admit 'whatsapp' alongside
-- 'email' and 'sms', and adds the opt-in flag WhatsApp needs that SMS never
-- did: SMS sends unconditionally whenever a phone is on file, but a WhatsApp
-- Business template landing in someone's personal chat app is a different
-- kind of intrusion, so it only goes out when the customer asked for it at
-- checkout.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_channel_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_channel_check CHECK (channel IN ('email', 'sms', 'whatsapp'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.whatsapp_opt_in IS
  'Set from the checkout checkbox. Gates the whatsapp arm in lib/notifications/index.ts -- unlike SMS, WhatsApp only sends when the customer opted in.';
