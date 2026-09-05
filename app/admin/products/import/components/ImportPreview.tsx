/** ADMIN layer — step three: what this file would do, before it does it.
 *
 * The creates and updates are separated because they carry very different
 * risk. Creating fifty products by mistake is untidy; updating fifty existing
 * ones by mistake overwrites prices that were right. So the update count is
 * the one called out, and every affected product is listed by name rather than
 * summarised as a number.
 *
 * Row problems block the import entirely rather than skipping those rows. Half
 * a catalogue, with no record of which half, is worse than a file you have to
 * fix and re-run.
 */
'use client';

import { AlertTriangle, PlusCircle, RefreshCw } from 'lucide-react';
import type { ImportIssue } from '@/lib/commerce/product-import';
import type { ImportPlanEntry, ImportSummary } from '../hooks/useProductImport';

interface ImportPreviewProps {
  summary: ImportSummary;
  plan: ImportPlanEntry[];
  issues: ImportIssue[];
}

function Figure({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-surface border border-border bg-surface p-4">
      <p className="text-body-sm text-text-secondary">{label}</p>
      <p className={`text-h4 font-bold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export function ImportPreview({ summary, plan, issues }: ImportPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Figure label="Products in file" value={summary.products} tone="text-text-primary" />
        <Figure label="Will be created" value={summary.creates} tone="text-success" />
        <Figure label="Will be updated" value={summary.updates} tone="text-warning" />
        <Figure
          label="Rows with problems"
          value={summary.rowsWithProblems}
          tone={summary.rowsWithProblems > 0 ? 'text-destructive' : 'text-text-primary'}
        />
      </div>

      {issues.length > 0 && (
        <div role="alert" className="rounded-surface border border-destructive-border bg-destructive-background p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-text-primary">
                {issues.length} row{issues.length === 1 ? '' : 's'} cannot be imported
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Nothing is written until these are fixed. Line numbers match your file.
              </p>
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-body-sm">
                {issues.map((issue, index) => (
                  <li key={`${issue.line}-${issue.field ?? ''}-${index}`}>
                    <span className="font-medium text-text-primary">Line {issue.line}</span>
                    {issue.field && <span className="text-text-secondary"> · {issue.field}</span>}
                    <span className="text-text-secondary"> — {issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {plan.length > 0 && (
        <div className="overflow-hidden rounded-surface border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                    Variants
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                    Lines
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {plan.map((entry) => (
                  <tr key={`${entry.action}-${entry.name}`}>
                    <td className="px-4 py-3 text-body-sm font-medium text-text-primary">{entry.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption-md font-medium ${
                          entry.action === 'create'
                            ? 'bg-success-background text-success'
                            : 'bg-warning-background text-warning'
                        }`}
                      >
                        {entry.action === 'create'
                          ? <PlusCircle className="size-3.5" aria-hidden="true" />
                          : <RefreshCw className="size-3.5" aria-hidden="true" />}
                        {entry.action === 'create' ? 'Create' : 'Update'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-body-sm text-text-secondary">{entry.variants}</td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {entry.lines.length > 4
                        ? `${entry.lines.slice(0, 4).join(', ')} +${entry.lines.length - 4}`
                        : entry.lines.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
