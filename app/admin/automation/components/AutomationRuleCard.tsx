/** ADMIN layer — one automation rule: what it does, whether it is on, and
 *  what it has done lately.
 *
 * The recent activity is on the card rather than in a log elsewhere, because
 * the question somebody has when they look at a rule is "is this actually
 * doing anything" — and a switch with no evidence behind it is a switch nobody
 * trusts enough to turn on.
 *
 * A rule that changes an order's status is marked as such. The difference
 * between a rule that emails you and one that cancels somebody's order is the
 * only thing on this screen worth a warning colour.
 */
'use client';

import { AlertTriangle, Check, Mail, Tag, X } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { cn } from '@/lib/utils';
import type { AutomationRuleRow, AutomationRunRow } from '../hooks/useAutomationRules';

const ACTION_LABEL: Record<string, { label: string; icon: React.ReactNode; changesData: boolean }> = {
  notify_admin: { label: 'Emails you', icon: <Mail size={14} aria-hidden />, changesData: false },
  change_status: {
    label: 'Changes the order',
    icon: <AlertTriangle size={14} aria-hidden />,
    changesData: true,
  },
  tag_customer: { label: 'Tags the customer', icon: <Tag size={14} aria-hidden />, changesData: true },
};

interface Props {
  rule: AutomationRuleRow;
  runs: AutomationRunRow[];
  pending: boolean;
  canToggle: boolean;
  onToggle: () => void;
}

export default function AutomationRuleCard({ rule, runs, pending, canToggle, onToggle }: Props) {
  const action = ACTION_LABEL[rule.action] ?? {
    label: rule.action,
    icon: null,
    changesData: false,
  };

  return (
    <article
      className={cn(
        'rounded-surface border bg-surface p-4 shadow-elevation-1 sm:p-5',
        rule.is_active ? 'border-border' : 'border-border-light'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-bold text-text-primary">{rule.name}</h3>
            <Badge tone={rule.is_active ? 'success' : 'neutral'}>
              {rule.is_active ? 'Running' : 'Off'}
            </Badge>
            <Badge tone={action.changesData ? 'warning' : 'info'} variant="subtle">
              <span className="inline-flex items-center gap-1">
                {action.icon}
                {action.label}
              </span>
            </Badge>
          </div>
          <p className="mt-1 max-w-prose text-body-sm text-text-secondary">{rule.description}</p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={pending || !canToggle}
          aria-pressed={rule.is_active}
          aria-label={`${rule.is_active ? 'Switch off' : 'Switch on'} ${rule.name}`}
          title={canToggle ? undefined : 'Only an owner can change automation rules'}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus',
            'disabled:opacity-60 disabled:pointer-events-none',
            rule.is_active ? 'bg-success' : 'bg-disabled'
          )}
        >
          {pending ? (
            <Spinner size="xs" className="mx-auto text-text-inverse" />
          ) : (
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-surface transition-transform',
                rule.is_active ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          )}
        </button>
      </div>

      <p className="mt-3 text-caption-md text-text-secondary">
        {rule.last_run_at
          ? `Last checked ${formatDate(rule.last_run_at)}${rule.last_run_note ? ` — ${rule.last_run_note}` : ''}`
          : 'Has not run yet.'}
        {rule.cooldown_hours
          ? ` · Repeats on the same item after ${Math.round(rule.cooldown_hours / 24)} days.`
          : ' · Acts once per item.'}
      </p>

      {runs.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border-light pt-3">
          {runs.map((run) => (
            <li key={run.id} className="flex items-start gap-2 text-caption-md">
              {run.outcome === 'failed' ? (
                <X size={13} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
              ) : (
                <Check size={13} className="mt-0.5 shrink-0 text-success" aria-hidden />
              )}
              <span className={run.outcome === 'failed' ? 'text-destructive' : 'text-text-secondary'}>
                <span className="font-medium text-text-primary">{run.subject_label ?? 'Item'}</span>
                {run.detail ? ` — ${run.detail}` : ''}
                <span className="text-text-muted"> · {formatDate(run.ran_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
