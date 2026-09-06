/**
 * COMMERCE layer (server only) — what a rule does once it has matched.
 *
 * Three actions, each of which delegates to a function that already exists and
 * is already used by a person clicking a button. Nothing here reimplements a
 * behaviour: changing a status goes through applyOrderStatusTransition, so
 * stock is released, history is written and the customer is told exactly as if
 * an admin had done it. An engine with its own private copy of "cancel an
 * order" is an engine that drifts from the product it automates.
 *
 * Every action returns an outcome rather than throwing. A rule that fired and
 * failed is the most important row in automation_rule_runs, and an exception
 * would lose it along with every subject after it.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendAdminNotification } from '@/lib/email';
import { escapeHtml } from '@/lib/notifications/escape-html';
import { applyOrderStatusTransition } from '../order-status-transition';
import { ORDER_STATUSES } from '../order-status';
import type { OrderStatus } from '@/types/order';
import { configString, type ActionOutcome, type AutomationRule, type Subject } from './types';

type ActionFn = (
  supabase: SupabaseClient,
  rule: AutomationRule,
  subject: Subject
) => Promise<ActionOutcome>;

/**
 * Email the shop.
 *
 * The safest action, and the one every rule can fall back to while its trigger
 * is still being trusted. Says which rule sent it, because an unexplained
 * email from your own software is one people filter.
 */
const notifyAdmin: ActionFn = async (_supabase, rule, subject) => {
  const subjectLine = configString(rule.action_config, 'subject', rule.name);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin: 0 0 4px;">${escapeHtml(subjectLine)}</h2>
      <p style="color: #6b7280; margin: 0 0 20px; font-size: 13px;">
        Sent by your automation rule &ldquo;${escapeHtml(rule.name)}&rdquo;.
      </p>
      <p style="font-size: 16px; margin: 0 0 8px;"><strong>${escapeHtml(subject.label)}</strong></p>
      <p style="color: #4b5563; margin: 0 0 24px;">${escapeHtml(rule.description)}</p>
      <p style="color: #9ca3af; font-size: 12px;">
        Turn this off or change its settings under Settings &rarr; Automation.
      </p>
    </div>
  `;

  const result = await sendAdminNotification(subjectLine, html);

  return result.success
    ? { ok: true, detail: `Emailed the shop about ${subject.label}` }
    : { ok: false, detail: `Could not email the shop: ${result.detail}` };
};

/**
 * Move an order.
 *
 * The dangerous one, and the reason cancel_stale_pending ships inactive. Goes
 * through the same transition the Admin uses, with no actor — the system did
 * this, and attributing it to whoever last signed in would be a lie on the
 * order's timeline.
 */
const changeStatus: ActionFn = async (supabase, rule, subject) => {
  if (subject.type !== 'order') {
    return { ok: false, detail: 'change_status can only act on an order' };
  }

  const next = configString(rule.action_config, 'status', '');
  if (!(ORDER_STATUSES as readonly string[]).includes(next)) {
    return { ok: false, detail: `"${next}" is not a status this shop uses` };
  }

  const result = await applyOrderStatusTransition(supabase, subject.id, next as OrderStatus, {
    sendNotification: true,
    reasonCode: configString(rule.action_config, 'reasonCode', '') || undefined,
    reason: configString(rule.action_config, 'reason', `Automation: ${rule.name}`),
  });

  return result.success
    ? { ok: true, detail: `Moved ${subject.label} to ${next}` }
    : { ok: false, detail: `Could not move ${subject.label}: ${result.error}` };
};

/**
 * Add a segment tag to the customer behind an order.
 *
 * Read-modify-write on a text[] rather than an append, because PostgREST has
 * no array-append and the alternative is an RPC for one rule. The window for a
 * lost concurrent tag is small and the cost of losing one is a label somebody
 * can re-apply.
 */
const tagCustomer: ActionFn = async (supabase, rule, subject) => {
  const tag = configString(rule.action_config, 'tag', '').trim().toLowerCase();
  if (!tag) return { ok: false, detail: 'No tag configured' };

  const customerId =
    subject.type === 'customer' ? subject.id : (subject.context?.customer_id as string | null);

  if (!customerId) {
    // A guest checkout with no customer row. Not a failure of the rule — there
    // is simply nobody to tag — so it is recorded as skipped rather than
    // retried every morning.
    return { ok: false, detail: `${subject.label} has no customer record to tag` };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('tags')
    .eq('id', customerId)
    .maybeSingle();

  const existing: string[] = customer?.tags ?? [];
  if (existing.includes(tag)) {
    return { ok: true, detail: `Already tagged "${tag}"` };
  }

  const { error } = await supabase
    .from('customers')
    .update({ tags: [...existing, tag] })
    .eq('id', customerId);

  return error
    ? { ok: false, detail: `Could not tag the customer: ${error.message}` }
    : { ok: true, detail: `Tagged the customer "${tag}"` };
};

const ACTIONS: Record<string, ActionFn> = {
  notify_admin: notifyAdmin,
  change_status: changeStatus,
  tag_customer: tagCustomer,
};

export async function runAction(
  supabase: SupabaseClient,
  rule: AutomationRule,
  subject: Subject
): Promise<ActionOutcome> {
  const action = ACTIONS[rule.action];
  if (!action) {
    return { ok: false, detail: `Unknown action "${rule.action}"` };
  }

  try {
    return await action(supabase, rule, subject);
  } catch (error) {
    // Contained here so one subject's failure does not abandon the rest of the
    // run — the whole value of the ledger is that the next pass picks up where
    // this one stopped.
    console.error(`Automation action ${rule.action} failed for ${subject.label}:`, error);
    return { ok: false, detail: error instanceof Error ? error.message : 'Action failed' };
  }
}
