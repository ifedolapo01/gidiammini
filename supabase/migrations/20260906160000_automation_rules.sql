-- ============================================================================
-- Automation, over the primitives that already exist
-- ----------------------------------------------------------------------------
-- The shop already has crons, status transitions, an alert engine and
-- notification sending. What it does not have is a way to add the next
-- automation without writing another cron: abandoned carts, payment reminders,
-- reservation sweeps, product pairs, customer auth and wishlist alerts are six
-- routes with six schedules, six auth checks and six bespoke ways of
-- remembering what they already did.
--
-- So every routine judgement stays manual: chase a receipt after 48 hours,
-- flag an order over 200,000 for a phone call, alert when a variant drops
-- below its reorder point.
--
-- One table of rules, one worker.
--
-- THE HARD PART IS NOT THE TRIGGER, IT IS REMEMBERING
--
-- Every existing cron solves "have I already done this?" with a column of its
-- own: orders.payment_reminder_sent_at, a row in order_review_invites,
-- discounts.notified_phases. A generic engine cannot add a column per rule, and
-- without an answer it is a machine for sending the same email every morning.
--
-- automation_rule_runs is that answer, and it is why this migration is mostly
-- about a ledger rather than about rules. One row per (rule, subject), holding
-- when it last fired and how often. A rule with no cooldown fires once per
-- subject ever; one with a cooldown fires again after it. The UNIQUE
-- constraint is what makes that true under two workers running at once, rather
-- than merely likely.
--
-- WHAT AN ACTION MAY BE
--
-- Only things the codebase can already do, and deliberately nothing else. The
-- temptation with a rules engine is to invent a small language; the failure
-- mode is a half-built one nobody can debug. Three actions, each of which maps
-- to a function that already exists and is already used elsewhere.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable identifier for the rules that ship with the product, so this
  -- migration can be re-run without duplicating them and so code may refer to
  -- one without hardcoding a uuid. Null for a rule somebody creates later.
  key text UNIQUE,

  name text NOT NULL,
  -- What it does, in the owner's words. Shown in the Admin; a rule nobody can
  -- read is a rule nobody dares switch on.
  description text NOT NULL DEFAULT '',

  -- What the worker looks for. Each value corresponds to one query in
  -- lib/commerce/automation/triggers.ts -- adding a trigger is code, not
  -- configuration, because a trigger is a database query and a text field that
  -- becomes one is how an admin panel turns into a SQL console.
  trigger text NOT NULL CHECK (trigger IN (
    -- An order that has sat in a status too long.
    'order_stalled',
    -- An order over a value worth a phone call before it ships.
    'order_high_value',
    -- A variant at or below the reorder point from its recent velocity.
    'variant_below_reorder_point'
  )),

  -- The numbers the trigger reads: { "hours": 48, "status": "pending" },
  -- { "amount": 200000 }. Shape is the trigger's business; kept as jsonb so a
  -- new threshold does not need a migration.
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  action text NOT NULL CHECK (action IN (
    -- Email the shop. The safest action, and the one every rule can fall back
    -- to while its trigger is still being trusted.
    'notify_admin',
    -- Move an order, through the same transition the Admin uses -- so stock is
    -- released, history is written and the customer is told, exactly as if a
    -- person had done it.
    'change_status',
    -- Append a segment tag to the customer.
    'tag_customer'
  )),

  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Off by default at the column level. A rule that arrives switched on is a
  -- rule that acts before anybody has read it, which for change_status means
  -- cancelling somebody's order on the strength of a default.
  is_active boolean NOT NULL DEFAULT false,

  -- How long before the same subject may trigger it again. NULL means once per
  -- subject, ever -- the right default for anything that emails a person.
  cooldown_hours integer CHECK (cooldown_hours IS NULL OR cooldown_hours > 0),

  last_run_at   timestamptz,
  last_run_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.automation_rules IS
  'Trigger, condition and action for the scheduled worker in app/api/cron/automation. Rules ship inactive; see the migration header.';
COMMENT ON COLUMN public.automation_rules.cooldown_hours IS
  'NULL means fire once per subject ever. Set it only where re-firing is genuinely wanted, e.g. a stock alert after a restock.';

CREATE INDEX IF NOT EXISTS automation_rules_active_idx
  ON public.automation_rules (is_active)
  WHERE is_active = true;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_rules FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- What each rule has already done
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_rule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,

  -- What it acted on. Not a foreign key: the subject is an order for one rule
  -- and a variant for another, and a nullable column per kind would be three
  -- columns of which two are always empty.
  subject_type text NOT NULL CHECK (subject_type IN ('order', 'variant', 'customer')),
  subject_id   uuid NOT NULL,
  -- How the subject reads in the Admin -- an order number, a product name.
  -- Stored because the row it names may later be deleted, and "acted on
  -- 9f3c…" is not an audit trail anybody can use.
  subject_label text,

  /** Whether the action actually succeeded. A rule that fired and failed is
      the most important row in this table, and recording only successes would
      hide it. */
  outcome text NOT NULL DEFAULT 'done' CHECK (outcome IN ('done', 'failed', 'skipped')),
  detail text,

  first_run_at timestamptz NOT NULL DEFAULT now(),
  ran_at       timestamptz NOT NULL DEFAULT now(),
  times_run    integer NOT NULL DEFAULT 1 CHECK (times_run > 0),

  -- The whole point of the table. One row per rule per subject, so "has this
  -- already fired?" is a lookup rather than a guess, and two workers running
  -- at once cannot both decide it has not.
  UNIQUE (rule_id, subject_type, subject_id)
);

COMMENT ON TABLE public.automation_rule_runs IS
  'One row per rule per subject. The generic replacement for payment_reminder_sent_at and friends -- see the migration header.';

CREATE INDEX IF NOT EXISTS automation_rule_runs_recent_idx
  ON public.automation_rule_runs (ran_at DESC);

CREATE INDEX IF NOT EXISTS automation_rule_runs_rule_idx
  ON public.automation_rule_runs (rule_id, ran_at DESC);

ALTER TABLE public.automation_rule_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_rule_runs FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- The three that ship
-- ---------------------------------------------------------------------------
-- Three, not a builder UI. The shape of a rules engine is not knowable until
-- real rules have run against real data for a while, and a builder designed
-- around three hypothetical ones would model the wrong thing in a way that is
-- expensive to undo. These prove the trigger/action seam; the UI to compose new
-- ones comes after.
--
-- ON CONFLICT DO NOTHING so re-running never resets a shop's own settings --
-- particularly is_active, which is the one an owner will have changed.
INSERT INTO public.automation_rules (key, name, description, trigger, trigger_config, action, action_config, is_active, cooldown_hours)
VALUES
  (
    'high_value_order',
    'Flag high-value orders',
    'Emails you when an order comes in above a set amount, so it can be confirmed by phone before it ships.',
    'order_high_value',
    '{"amount": 200000}'::jsonb,
    'notify_admin',
    '{"subject": "High-value order needs a check"}'::jsonb,
    true,
    NULL
  ),
  (
    'reorder_point_reached',
    'Alert when stock hits its reorder point',
    'Emails you when a variant falls to the level where its recent sales say it should be reordered.',
    'variant_below_reorder_point',
    '{}'::jsonb,
    'notify_admin',
    '{"subject": "Stock is due a reorder"}'::jsonb,
    true,
    -- Days, not once-ever: a variant that is restocked and sells down again is
    -- genuinely due a second alert, and a once-ever rule would go quiet after
    -- the first one forever.
    168
  ),
  (
    'cancel_stale_pending',
    'Cancel orders never paid for',
    'Cancels an order that has sat unpaid for the set number of days, releasing its stock. Off until you turn it on.',
    'order_stalled',
    '{"status": "pending", "hours": 168}'::jsonb,
    'change_status',
    '{"status": "cancelled", "reasonCode": "payment_not_received", "reason": "No payment received after 7 days."}'::jsonb,
    -- Inactive. This one cancels real orders, and arriving switched on would
    -- mean it acted before anybody read what it does.
    false,
    NULL
  )
ON CONFLICT (key) DO NOTHING;
