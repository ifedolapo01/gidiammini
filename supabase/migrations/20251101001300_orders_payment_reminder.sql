-- Tracks whether a customer has already been emailed a "you haven't paid
-- yet" reminder for a still-pending order, so the reminder cron never sends
-- more than once per order. NULL = not yet reminded.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMP WITH TIME ZONE;
