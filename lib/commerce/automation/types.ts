/**
 * COMMERCE layer — the vocabulary of the automation engine. Pure.
 *
 * Kept in its own leaf so the triggers, the actions and the worker can all
 * name these without importing one another.
 */

export const AUTOMATION_TRIGGERS = [
  'order_stalled',
  'order_high_value',
  'variant_below_reorder_point',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTIONS = ['notify_admin', 'change_status', 'tag_customer'] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export type SubjectType = 'order' | 'variant' | 'customer';

export interface AutomationRule {
  id: string;
  key: string | null;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  action: AutomationAction;
  action_config: Record<string, unknown>;
  is_active: boolean;
  /** Null means fire once per subject, ever. */
  cooldown_hours: number | null;
  last_run_at: string | null;
  last_run_note: string | null;
}

/**
 * One thing a rule matched.
 *
 * `label` travels with it so a run row can say "UT00104221" rather than a
 * uuid — the subject may be deleted later, and the record has to stay
 * readable.
 */
export interface Subject {
  type: SubjectType;
  id: string;
  label: string;
  /** Whatever the action needs that the trigger already loaded, so an action
   *  does not re-query a row the trigger just read. */
  context: Record<string, unknown>;
}

export interface ActionOutcome {
  ok: boolean;
  /** One line for the run record, and for the Admin's activity list. */
  detail: string;
}

/** How a rule's numbers are read, with a fallback rather than a throw: a
 *  hand-edited config must degrade to a sane default, not take the worker
 *  down for every other rule. */
export function configNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = Number(config?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function configString(
  config: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}
