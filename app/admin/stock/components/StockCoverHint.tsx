/** ADMIN layer — how long this variant's stock will last, under its badge.
 *
 * A line of text rather than a column of its own: the table already carries
 * six columns and a parent/child row structure, and the reading belongs to the
 * stock figure it sits under rather than standing beside it.
 *
 * Renders nothing at all when there is nothing worth saying — no ledger
 * history, no sales, a variant that predates the table. A row of dashes across
 * a whole page is worse than a quiet column: it looks like the feature is
 * broken rather than like it is waiting for data.
 */
import { AlertTriangle } from 'lucide-react';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';

interface StockCoverHintProps {
  insight?: VariantInsight;
}

export function StockCoverHint({ insight }: StockCoverHintProps) {
  // Nothing has sold, so there is no rate — which the aging report covers in
  // detail and this line would only restate as an em dash.
  if (!insight || insight.velocity <= 0) return null;

  const days = insight.daysOfCover;
  if (days === null) return null;

  const rounded = Math.round(days);
  const urgent = insight.needsReorder;

  return (
    <p
      className={`mt-1 text-caption-md ${urgent ? 'text-warning font-medium' : 'text-text-secondary'}`}
      // The velocity and the caveat belong to somebody hovering, not to every
      // row at once.
      title={
        `Selling ${insight.velocity.toFixed(2)} a day` +
        (insight.confident ? '' : ` — based on only ${insight.observedDays} days of history`)
      }
    >
      {urgent && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" aria-hidden />}
      {rounded < 1 ? 'Under a day left' : `~${rounded} days left`}
      {/* An asterisk rather than a sentence: the page-level notice on the
          reports screen explains it, and repeating "based on 4 days" on fifty
          rows would drown the numbers it is qualifying. */}
      {!insight.confident && <span title="Early estimate — little stock history yet"> *</span>}
    </p>
  );
}
