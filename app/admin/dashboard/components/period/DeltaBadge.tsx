/** ADMIN layer — the change against the previous period, as a chip.
 *
 * WHY DIRECTION AND GOODNESS ARE SEPARATE
 *
 * Up is not always good. Revenue rising is green; the cancellation rate rising
 * is not. A badge that colours every increase green would quietly congratulate
 * a shop on its returns going up, so each caller says which way is better and
 * the arrow and the colour are decided independently — the arrow follows the
 * number, the colour follows whether that is welcome.
 *
 * A null delta renders as words, not as a dash. "No comparison" says something
 * true about a shop's first month; "—" reads like a bug.
 */
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Delta } from '@/lib/commerce/period-metrics';

interface DeltaBadgeProps {
  delta: Delta | null;
  /** Which direction counts as an improvement for this metric. */
  goodDirection?: 'up' | 'down';
  /** What it is being compared against, for the tooltip. */
  comparison: string;
}

export function DeltaBadge({ delta, goodDirection = 'up', comparison }: DeltaBadgeProps) {
  if (!delta) {
    return (
      <span
        className="text-caption-md text-text-muted"
        title="There is nothing in the previous period to compare against"
      >
        No comparison yet
      </span>
    );
  }

  const Icon =
    delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : ArrowRight;

  const good = delta.direction === goodDirection;
  const tone =
    delta.direction === 'flat'
      ? 'bg-background-tertiary text-text-secondary'
      : good
        ? 'bg-success-background text-success'
        : 'bg-destructive-background text-destructive';

  // Rounded to a whole percent below 10x, because a dashboard reader acts on
  // "up 14%" and never on "up 13.7%". Beyond that the multiple is the honest
  // shape: "+1,400%" is noise where "15x" is a fact.
  const magnitude = Math.abs(delta.change);
  const text =
    magnitude >= 10
      ? `${Math.round(magnitude)}×`
      : `${Math.round(magnitude * 100)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-caption-md font-medium',
        tone
      )}
      title={`${delta.direction === 'flat' ? 'Roughly unchanged' : text} ${comparison}`}
    >
      <Icon size={12} aria-hidden />
      {delta.direction === 'flat' ? 'Flat' : text}
    </span>
  );
}
