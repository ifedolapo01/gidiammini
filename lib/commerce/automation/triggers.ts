/**
 * COMMERCE layer (server only) — what each rule looks for.
 *
 * One function per trigger, each returning the subjects it matched. Triggers
 * are code rather than configuration on purpose: a trigger is a database
 * query, and a text field that becomes one is how an admin panel turns into a
 * SQL console. Adding a trigger is a function here plus a value in the CHECK
 * constraint — a deliberate, reviewable change.
 *
 * Each is capped. A rule whose condition accidentally matches the whole
 * catalogue should do a bounded amount of damage in one run and be obvious in
 * the run record, rather than emailing four thousand times before anybody
 * notices.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ORDER_STATUSES } from '../order-status';
import { variantInsight } from '../inventory-analytics';
import { fetchVariantFacts } from '../inventory-query';
import { readStoreSettings } from '../store-settings-server';
import { configNumber, configString, type AutomationRule, type Subject } from './types';

/** Subjects one rule may act on in a single run. */
export const MAX_SUBJECTS = 100;

type TriggerFn = (supabase: SupabaseClient, rule: AutomationRule) => Promise<Subject[]>;

/** An order that has sat in one status too long. */
const orderStalled: TriggerFn = async (supabase, rule) => {
  const hours = configNumber(rule.trigger_config, 'hours', 168);
  const status = configString(rule.trigger_config, 'status', 'pending');

  // Narrowed against the real vocabulary: a typo in the config must match
  // nothing rather than silently becoming a query for every order.
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return [];

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, customer_name, status, total_amount')
    .eq('status', status)
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_SUBJECTS);

  return (data ?? []).map((order: any) => ({
    type: 'order' as const,
    id: order.id,
    label: order.order_number,
    context: order,
  }));
};

/** An order big enough to be worth a phone call before it ships. */
const orderHighValue: TriggerFn = async (supabase, rule) => {
  const amount = configNumber(rule.trigger_config, 'amount', 200_000);

  const { data } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, customer_name, customer_phone, status, total_amount')
    .gte('total_amount', amount)
    // Only orders still in play. Flagging a delivered order for a pre-delivery
    // phone call is advice about something that already happened.
    .not('status', 'in', '("cancelled","delivered","picked_up")')
    .order('total_amount', { ascending: false })
    .limit(MAX_SUBJECTS);

  return (data ?? []).map((order: any) => ({
    type: 'order' as const,
    id: order.id,
    label: order.order_number,
    context: order,
  }));
};

/**
 * A variant that has fallen to its reorder point.
 *
 * Reads the same analytics the Reorder & aging report does rather than a fixed
 * threshold, so the alert fires on how fast the line actually sells. That is
 * only possible because inventory_movements exists — before the ledger, this
 * rule could not have been written.
 */
const variantBelowReorderPoint: TriggerFn = async (supabase) => {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color, stock, products!inner(name, is_active)')
    .eq('products.is_active', true)
    .gt('stock', 0)
    .limit(500);

  const rows = (variants ?? []) as any[];
  if (rows.length === 0) return [];

  const [settings, facts] = await Promise.all([
    readStoreSettings(supabase),
    fetchVariantFacts(supabase, rows.map((variant) => variant.id)),
  ]);

  const policy = { leadDays: settings.reorderLeadDays, coverDays: settings.reorderCoverDays };
  const byId = new Map(rows.map((variant) => [variant.id, variant]));

  return facts
    .map((fact) => variantInsight(fact, policy))
    // needsReorder already excludes anything that is not selling — a line with
    // no demand is a clearance problem, not a buying one, and alerting on it
    // weekly would train the shop to ignore this rule.
    .filter((insight) => insight.needsReorder && insight.confident)
    .slice(0, MAX_SUBJECTS)
    .map((insight) => {
      const variant = byId.get(insight.variantId);
      const axes = [variant?.size, variant?.color].filter(Boolean).join(' / ');

      return {
        type: 'variant' as const,
        id: insight.variantId,
        label: `${variant?.products?.name ?? 'Product'}${axes ? ` (${axes})` : ''}`,
        context: { insight, stock: variant?.stock ?? 0 },
      };
    });
};

const TRIGGERS: Record<string, TriggerFn> = {
  order_stalled: orderStalled,
  order_high_value: orderHighValue,
  variant_below_reorder_point: variantBelowReorderPoint,
};

/** Everything this rule matches now. An unknown trigger matches nothing rather
 *  than throwing — one bad row must not stop the other rules running. */
export async function findSubjects(
  supabase: SupabaseClient,
  rule: AutomationRule
): Promise<Subject[]> {
  const trigger = TRIGGERS[rule.trigger];
  if (!trigger) {
    console.error(`Automation rule ${rule.key ?? rule.id} has unknown trigger "${rule.trigger}".`);
    return [];
  }

  return trigger(supabase, rule);
}
