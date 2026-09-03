/**
 * ADMIN layer — the full story behind one audit entry.
 *
 * The table is deliberately thin: when, what kind of action, on what, and a
 * one-line summary. Everything else lives here, because a feed you have to read
 * sideways is not a feed. This is where "what exactly did that product update
 * change" gets answered.
 *
 * The timestamp is shown with its timezone named. An audit entry is evidence,
 * and whoever reads it later may not be sitting in the same timezone as
 * whoever wrote it.
 */
'use client';

import { Badge, Modal } from '@/components/ui';
import { formatDateWithZone } from '@/lib/commerce/format-date';
import {
  actionLabel,
  actionTone,
  actorLabel,
  entityLabel,
  entityShortId,
  fieldChanges,
  isFailedAttempt,
  type AuditLogEntry,
} from '@/lib/commerce/audit-format';

const CELL = 'px-3 py-2 align-top text-caption-md';

/** One labelled fact about the request itself. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption-md text-text-secondary">{label}</dt>
      <dd className="text-body-sm text-text-primary break-words">{children}</dd>
    </div>
  );
}

interface ActivityDetailModalProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

export default function ActivityDetailModal({ entry, onClose }: ActivityDetailModalProps) {
  if (!entry) return null;

  const changes = fieldChanges(entry);
  const failed = isFailedAttempt(entry);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${actionLabel(entry.action)} · ${entityLabel(entry.entity_type)}`}
      size="lg"
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge tone={failed ? 'destructive' : actionTone(entry.action)} variant="subtle">
          {actionLabel(entry.action)}
        </Badge>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Fact label="When">{formatDateWithZone(entry.created_at)}</Fact>
        <Fact label="By">{actorLabel(entry)}</Fact>
        <Fact label="Item">
          {entityLabel(entry.entity_type)}
          {entry.entity_id && (
            /* The short id is the informative half of a variant key. The full
               value is a 36-character uuid that wrapped mid-word across two
               lines and told the reader nothing; it stays on the title
               attribute for anyone who needs to copy it. */
            <span
              className="block font-mono text-caption-md text-text-secondary truncate"
              title={entry.entity_id}
            >
              {entityShortId(entry)}
            </span>
          )}
        </Fact>
        <Fact label="From">{entry.ip || '—'}</Fact>
      </dl>

      {entry.reason && (
        <div className="mb-6 p-3 rounded-control bg-background-secondary border border-border">
          <p className="text-caption-md text-text-secondary mb-1">Reason given</p>
          <p className="text-body-sm text-text-primary">{entry.reason}</p>
        </div>
      )}

      <h3 className="font-semibold text-text-primary mb-2">
        {changes.length > 0
          ? `What changed (${changes.length})`
          : 'What changed'}
      </h3>

      {changes.length === 0 ? (
        <p className="text-body-sm text-text-secondary">
          No field-level changes were recorded for this entry.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-surface">
          <table className="min-w-full">
            <thead className="bg-background-secondary">
              <tr>
                <th scope="col" className={`${CELL} text-left font-medium text-text-secondary uppercase tracking-wider`}>
                  Field
                </th>
                <th scope="col" className={`${CELL} text-left font-medium text-text-secondary uppercase tracking-wider`}>
                  Was
                </th>
                <th scope="col" className={`${CELL} text-left font-medium text-text-secondary uppercase tracking-wider`}>
                  Changed to
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {changes.map((change) => (
                <tr key={change.field}>
                  <td className={`${CELL} text-text-secondary whitespace-nowrap`}>{change.field}</td>
                  <td className={`${CELL} text-text-muted line-through break-all max-w-xs`}>{change.from}</td>
                  <td className={`${CELL} text-text-primary font-medium break-all max-w-xs`}>{change.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
