-- ============================================================================
-- What we actually sent, to whom, and what happened to it
-- ----------------------------------------------------------------------------
-- Every notification in this shop is fire-and-forget. sendOrderEmail() returns
-- a result, the caller reads it to decide what toast to show, and then throws
-- it away. So when a customer says "I never got the confirmation", the shop
-- has nothing: no record that a message was attempted, no address it went to,
-- no reason it might have failed, and no way to send it again short of
-- changing the order's status and hoping.
--
-- One row per attempt, kept forever.
--
-- WHAT THIS CAN AND CANNOT KNOW
--
-- The transport is SMTP through nodemailer (lib/email.ts), not a provider with
-- a delivery API. That draws a hard line through the middle of this table:
--
--   Knowable now   whether the SMTP server accepted the message, the
--                  Message-ID it was given, and which recipients the server
--                  refused outright at handshake (nodemailer's `rejected`) --
--                  which is a hard bounce, detected synchronously.
--   Not knowable   whether it reached an inbox, was deferred, bounced hours
--                  later, or was marked as spam. SMTP has no callback. That
--                  needs either a provider that posts webhooks (Resend,
--                  Postmark, SES via SNS) or an IMAP reader watching the
--                  sending mailbox for bounce reports.
--
-- The 'delivered', 'bounced' and 'complained' statuses exist here anyway, and
-- deliberately so: they are the states a provider would report, the ingestion
-- code has somewhere to write when one is added, and nothing has to be
-- migrated on the day that happens. Until then no row will ever hold them
-- except a hard rejection at send time, and the Admin says so rather than
-- implying a silence means success.
--
-- WHY NOT audit_log
--
-- audit_log answers "who changed what", is written only for admin requests,
-- and is prunable. This answers "what did the shop send this customer", is
-- mostly written by checkouts and crons with no admin involved, and is the
-- record a dispute is settled from. Different questions, different retention,
-- different writers.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  channel text NOT NULL CHECK (channel IN ('email', 'sms')),

  -- What the message was for. Free-ish text rather than a rigid enum: a new
  -- template should not need a migration, and the values are supplied from one
  -- list in lib/notifications/kinds.ts. Constrained only in shape, so a typo
  -- is visible rather than silently creating a new category.
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{2,39}$'),

  -- The address or number it went to, as it was at the time. Stored rather
  -- than joined: the whole point is answering "where did you send it", and a
  -- customer who has since corrected their email would otherwise erase the
  -- evidence of why they never got the first one.
  recipient text NOT NULL,

  order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  subject text,

  status text NOT NULL DEFAULT 'sent' CHECK (status IN (
    -- Handed to the SMTP server, which accepted it. The best this transport
    -- can currently report, and explicitly not the same as 'delivered'.
    'sent',
    -- Never left: not configured, no address, or the server errored.
    'failed',
    -- The receiving server refused this recipient. Set from nodemailer's
    -- `rejected` list at send time, or by a provider webhook later.
    'bounced',
    -- Reserved for a provider that can report these. See the header.
    'delivered',
    'complained'
  )),

  -- The SMTP Message-ID, or a provider's own id. What a mail server's logs are
  -- searched by when a customer escalates.
  provider_message_id text,

  -- One of DeliveryFailureReason (lib/notifications/delivery.ts), so the Admin
  -- can say "no address on file" rather than pasting a stack trace at somebody.
  failure_reason text,
  failure_detail text,

  -- Set when an admin pressed Resend. Null for the automatic send.
  actor_id uuid,
  -- The notification this one repeats, so a timeline can show "resent" under
  -- the original instead of as an unexplained duplicate.
  resend_of uuid REFERENCES public.notifications(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  -- Moves when a provider later reports a bounce against a row already sent.
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'Every notification attempt, one row each. Written by lib/notifications/log.ts. status = ''sent'' means the SMTP server accepted it, not that it arrived -- see the migration header.';
COMMENT ON COLUMN public.notifications.status IS
  '''sent'' is acceptance by the mail server. ''delivered'' and ''complained'' are reserved for a provider that can report them; nothing sets them today.';
COMMENT ON COLUMN public.notifications.recipient IS
  'The address or number used at the time, stored rather than joined -- a corrected email must not erase why the first message never arrived.';

-- The order timeline. Every read of this table from the Admin is this query.
CREATE INDEX IF NOT EXISTS notifications_order_idx
  ON public.notifications (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

-- "What have we ever sent this person?" -- asked when somebody calls in about
-- an order they cannot name.
CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON public.notifications (recipient, created_at DESC);

-- The failure queue: what did not go out, newest first. Partial, because on a
-- healthy shop this is a tiny fraction of the table.
CREATE INDEX IF NOT EXISTS notifications_problem_idx
  ON public.notifications (created_at DESC)
  WHERE status IN ('failed', 'bounced', 'complained');

-- Matching a provider webhook back to the row it concerns.
CREATE INDEX IF NOT EXISTS notifications_provider_idx
  ON public.notifications (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
-- No policies: RLS on with nothing granted. service_role bypasses it. Same
-- shape as every other locked table in 20251101001700. This one especially --
-- it holds every address the shop has ever mailed.

-- ---------------------------------------------------------------------------
-- Unsubscribing
-- ---------------------------------------------------------------------------
-- subscribers.is_active has existed since 20251101000500 and nothing has ever
-- been able to set it to false except an admin editing the row by hand. Bulk
-- marketing without a working unsubscribe is a legal problem under the NDPR
-- and its equivalents, not a missing nicety.
--
-- No token column. The link is an HMAC of the subscriber id under a server
-- secret (lib/notifications/unsubscribe-token.ts) rather than a stored bearer
-- token, because unlike a sign-in link it must keep working in an email sent
-- two years ago, must be regenerable for every send without rotating anything,
-- and grants nothing except the ability to stop receiving mail.
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  -- How they left: 'link' (the footer), 'admin', 'bounce' (the address is
  -- dead). Worth separating -- a list shrinking through bounces is a sending
  -- reputation problem, and a list shrinking through the link is a content one.
  ADD COLUMN IF NOT EXISTS unsubscribe_source text
    CHECK (unsubscribe_source IS NULL OR unsubscribe_source IN ('link', 'admin', 'bounce'));

COMMENT ON COLUMN public.subscribers.unsubscribed_at IS
  'When they opted out. is_active stays the flag every send filters on; this records when and, with unsubscribe_source, how.';

-- Who is still on the list. The marketing send reads exactly this.
CREATE INDEX IF NOT EXISTS subscribers_active_idx
  ON public.subscribers (is_active)
  WHERE is_active = true;
