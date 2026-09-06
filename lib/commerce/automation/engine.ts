/**
 * COMMERCE layer (server only) — the one worker that runs every rule.
 *
 * Replaces the pattern of a cron per automation. What it adds over six bespoke
 * routes is not scheduling — that part was never hard — but the shared answer
 * to "have I already done this to this thing?", which each of those routes
 * solves with a column of its own.
 *
 * ORDER OF OPERATIONS, AND WHY IT IS THIS WAY
 *
 * The run row is claimed *before* the action, not after. If the action
 * succeeds and the process then dies before recording it, a claim-after
 * ordering would repeat it on the next pass — which for an email is a
 * duplicate and for a cancellation is worse. Claiming first means the failure
 * mode is a missed action that shows in the ledger as an attempt, which
 * somebody can see and re-run deliberately.
 *
 * One rule's failure never stops another's. Each rule is wrapped, each subject
 * is wrapped, and the worker's job is to get through the list.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runAction } from './actions';
import { findSubjects } from './triggers';
import type { AutomationRule, Subject } from './types';

export interface RuleReport {
  rule: string;
  matched: number;
  acted: number;
  skipped: number;
  failed: number;
}

/** Whether this rule may act on this subject again yet. */
function isDue(
  existing: { ran_at: string } | undefined,
  cooldownHours: number | null
): boolean {
  if (!existing) return true;
  // No cooldown means once per subject, ever.
  if (cooldownHours === null) return false;

  const elapsed = Date.now() - Date.parse(existing.ran_at);
  return elapsed >= cooldownHours * 60 * 60 * 1000;
}

/** The runs already recorded for these subjects, in one query rather than one
 *  per subject. */
async function existingRuns(
  supabase: SupabaseClient,
  ruleId: string,
  subjects: Subject[]
): Promise<Map<string, { ran_at: string; times_run: number }>> {
  if (subjects.length === 0) return new Map();

  const { data } = await supabase
    .from('automation_rule_runs')
    .select('subject_id, ran_at, times_run')
    .eq('rule_id', ruleId)
    .in('subject_id', subjects.map((subject) => subject.id));

  return new Map(
    (data ?? []).map((row: any) => [row.subject_id as string, { ran_at: row.ran_at, times_run: row.times_run }])
  );
}

/**
 * Claims the subject for this rule, or reports that somebody else already has.
 *
 * The UNIQUE (rule_id, subject_type, subject_id) is what makes this safe under
 * two workers at once: the second one's insert conflicts, and it walks away
 * rather than sending a second email.
 */
async function claim(
  supabase: SupabaseClient,
  rule: AutomationRule,
  subject: Subject,
  previous: { times_run: number } | undefined
): Promise<boolean> {
  const now = new Date().toISOString();

  if (previous) {
    const { error } = await supabase
      .from('automation_rule_runs')
      .update({ ran_at: now, times_run: previous.times_run + 1, outcome: 'done', detail: null })
      .eq('rule_id', rule.id)
      .eq('subject_type', subject.type)
      .eq('subject_id', subject.id);

    return !error;
  }

  const { error } = await supabase.from('automation_rule_runs').insert({
    rule_id: rule.id,
    subject_type: subject.type,
    subject_id: subject.id,
    subject_label: subject.label,
    first_run_at: now,
    ran_at: now,
  });

  // A unique violation means a concurrent worker got there first. Not an error
  // — it is the constraint doing its job.
  return !error;
}

async function recordOutcome(
  supabase: SupabaseClient,
  rule: AutomationRule,
  subject: Subject,
  outcome: { ok: boolean; detail: string }
): Promise<void> {
  await supabase
    .from('automation_rule_runs')
    .update({ outcome: outcome.ok ? 'done' : 'failed', detail: outcome.detail })
    .eq('rule_id', rule.id)
    .eq('subject_type', subject.type)
    .eq('subject_id', subject.id);
}

async function runRule(supabase: SupabaseClient, rule: AutomationRule): Promise<RuleReport> {
  const report: RuleReport = { rule: rule.key ?? rule.name, matched: 0, acted: 0, skipped: 0, failed: 0 };

  const subjects = await findSubjects(supabase, rule);
  report.matched = subjects.length;

  const already = await existingRuns(supabase, rule.id, subjects);

  for (const subject of subjects) {
    const previous = already.get(subject.id);

    if (!isDue(previous, rule.cooldown_hours)) {
      report.skipped += 1;
      continue;
    }

    // Claimed first. See the header.
    if (!(await claim(supabase, rule, subject, previous))) {
      report.skipped += 1;
      continue;
    }

    const outcome = await runAction(supabase, rule, subject);
    await recordOutcome(supabase, rule, subject, outcome);

    if (outcome.ok) report.acted += 1;
    else report.failed += 1;
  }

  await supabase
    .from('automation_rules')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_note: `${report.matched} matched, ${report.acted} acted, ${report.skipped} already done, ${report.failed} failed`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rule.id);

  return report;
}

/** Runs every active rule, and reports on each. */
export async function runAutomationRules(supabase: SupabaseClient): Promise<RuleReport[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const reports: RuleReport[] = [];

  for (const rule of (data ?? []) as unknown as AutomationRule[]) {
    try {
      reports.push(await runRule(supabase, rule));
    } catch (ruleError) {
      // One broken rule must not stop the others. The whole argument for a
      // single worker is that adding a rule is cheap; that stops being true
      // the moment one of them can take the rest down.
      console.error(`Automation rule ${rule.key ?? rule.id} failed:`, ruleError);
      reports.push({ rule: rule.key ?? rule.name, matched: 0, acted: 0, skipped: 0, failed: 1 });
    }
  }

  return reports;
}
