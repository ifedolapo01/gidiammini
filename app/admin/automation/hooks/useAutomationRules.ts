/** ADMIN layer — the automation rules and their recent activity. */
'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AutomationRuleRow {
  id: string;
  key: string | null;
  name: string;
  description: string;
  trigger: string;
  trigger_config: Record<string, unknown>;
  action: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  cooldown_hours: number | null;
  last_run_at: string | null;
  last_run_note: string | null;
}

export interface AutomationRunRow {
  id: string;
  rule_id: string;
  subject_label: string | null;
  outcome: 'done' | 'failed' | 'skipped';
  detail: string | null;
  ran_at: string;
  times_run: number;
}

export function useAutomationRules(
  showToast: (message: string, type?: 'success' | 'error') => void
) {
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [recent, setRecent] = useState<AutomationRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** The table is not there — a deployment that has not applied
   *  20260906160000. Distinct from a shop with no rules. */
  const [unavailable, setUnavailable] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/automation');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error('Failed to load');

      setRules(data.rules ?? []);
      setRecent(data.recent ?? []);
      setUnavailable(Boolean(data.unavailable));
    } catch (error) {
      console.error('Error loading automation rules:', error);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (rule: AutomationRuleRow) => {
      setPendingId(rule.id);
      try {
        const response = await fetch('/api/admin/automation', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          showToast(data?.error || 'Could not change that rule.', 'error');
          return;
        }

        // Reloaded rather than flipped locally: the server decides, and a
        // switch that shows "on" for a rule that did not save is the one thing
        // this screen must not do.
        await load();
        showToast(
          rule.is_active ? `"${rule.name}" switched off.` : `"${rule.name}" is now running.`
        );
      } catch (error) {
        console.error('Error toggling automation rule:', error);
        showToast('Could not change that rule.', 'error');
      } finally {
        setPendingId(null);
      }
    },
    [load, showToast]
  );

  return { rules, recent, loading, unavailable, pendingId, toggle, reload: load };
}
