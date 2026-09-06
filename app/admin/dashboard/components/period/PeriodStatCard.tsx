/** ADMIN layer — one period figure: the number, the change, and the way in.
 *
 * Distinct from StatCard, which shows an all-time count with a line of
 * context. This one always carries a comparison and, where there are rows
 * behind it, a link to them.
 *
 * THE WHOLE CARD IS THE LINK
 *
 * An analytics panel you cannot drill into never gets trusted — a number
 * nobody can check is a number nobody acts on. So where a figure has rows
 * behind it, the entire card is the target rather than a small "view" link in
 * a corner: the thing the reader is already looking at is the thing to click.
 * Cards with nothing to show (a rate, an average) stay inert rather than
 * linking somewhere approximate.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Delta } from '@/lib/commerce/period-metrics';
import { DeltaBadge } from './DeltaBadge';

interface PeriodStatCardProps {
  title: string;
  icon: ReactNode;
  iconBgClassName: string;
  value: ReactNode;
  delta: Delta | null;
  comparison: string;
  goodDirection?: 'up' | 'down';
  /** A line of context under the number — the count a rate was taken over,
   *  usually. A rate with no denominator is not a finding. */
  subtext?: ReactNode;
  /** Where the rows behind this figure live. Omitted for a derived number
   *  that has no list of its own. */
  href?: string;
}

export function PeriodStatCard({
  title,
  icon,
  iconBgClassName,
  value,
  delta,
  comparison,
  goodDirection,
  subtext,
  href,
}: PeriodStatCardProps) {
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-body-sm font-semibold text-text-secondary">{title}</h3>
        <div className={cn('flex-shrink-0 rounded-control p-2.5', iconBgClassName)}>{icon}</div>
      </div>

      <p className="break-words text-h4 font-bold text-text-primary xl:text-h3">{value}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeltaBadge delta={delta} goodDirection={goodDirection} comparison={comparison} />
        {subtext && <span className="text-caption-md text-text-secondary">{subtext}</span>}
      </div>
    </>
  );

  const shell = 'rounded-surface border border-border bg-surface p-4 shadow-elevation-1 xl:p-5';

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        shell,
        'group relative block transition-colors hover:border-primary/40 hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus'
      )}
    >
      {body}
      {/* Only on hover and focus: on a grid of five cards, five permanent
          arrows are five things competing with the numbers. */}
      <ArrowUpRight
        size={14}
        aria-hidden
        className="absolute bottom-3 right-3 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </Link>
  );
}
