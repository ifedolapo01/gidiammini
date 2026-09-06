/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/automation/page.tsx — the standing instructions the shop follows
// on its own.
//
// Three rules, and no builder. The shape of a rules engine is not knowable
// until real rules have run against real data, and a builder designed around
// three hypothetical ones would model the wrong thing in a way that is
// expensive to undo. These prove the trigger/action seam; composing new ones
// comes after.
//
// Reading is store:read — everyone who works here should be able to see what
// the software does without being asked. Switching one on is owner-only,
// because a rule that cancels orders is a standing instruction to the business
// rather than a screen preference.
'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { can } from '@/lib/api/admin-roles';
import { useAdminIdentity } from '../hooks/useAdminIdentity';
import { useToast } from '../hooks/useToast';
import { useAutomationRules } from './hooks/useAutomationRules';
import AutomationRuleCard from './components/AutomationRuleCard';
import { AutomationSkeleton } from './components/AutomationSkeleton';

/** Recent runs shown under each rule. */
const RUNS_PER_RULE = 5;

export default function AutomationPage() {
  const { admin } = useAdminIdentity();
  const { showToast } = useToast();
  const { rules, recent, loading, unavailable, pendingId, toggle } = useAutomationRules(showToast);

  const canToggle = can(admin?.role, 'settings:write');

  if (loading) return <AutomationSkeleton />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-h4 font-bold text-text-primary">Automation</h1>
        <p className="text-text-secondary">
          Routine decisions the shop makes without you. Each one runs once a morning.
        </p>
      </div>

      {unavailable ? (
        <p className="rounded-control border border-warning-border bg-warning-background p-3 text-body-sm text-warning">
          Automation is not available on this deployment yet — apply migration 20260906160000 to
          switch it on.
        </p>
      ) : (
        <>
          {!canToggle && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-control border border-info-border bg-info-background p-3 text-body-sm text-info"
            >
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
              These are the rules the shop is running. Only an owner can switch one on or off.
            </p>
          )}

          {rules.length === 0 ? (
            <p className="rounded-surface border border-border bg-surface p-8 text-center text-text-secondary">
              No automation rules are set up.
            </p>
          ) : (
            rules.map((rule) => (
              <AutomationRuleCard
                key={rule.id}
                rule={rule}
                runs={recent.filter((run) => run.rule_id === rule.id).slice(0, RUNS_PER_RULE)}
                pending={pendingId === rule.id}
                canToggle={canToggle}
                onToggle={() => toggle(rule)}
              />
            ))
          )}

          <p className="text-caption-md text-text-secondary">
            The thresholds these rules use — the reorder point, the high-value amount — come from{' '}
            <Link href="/admin/settings" className="text-primary hover:text-primary-hover">
              Settings
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
