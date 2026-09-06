/** ADMIN layer — the size run, as a buying recommendation. Presentation only.
 *
 * A bar per size rather than a table of ratios. The question this answers is
 * comparative — "which of these should I buy more of" — and a reader spots a
 * short bar next to a long one faster than they compare 1.62 against 0.41. The
 * numbers are still there for anyone who wants them.
 *
 * The baseline is drawn at 1.0 because that is where the recommendation turns
 * over; without the line the bars are decoration.
 */
'use client';

import { Badge, type BadgeTone } from '@/components/ui';
import type { SizeInsight, SizeVerdict } from '@/lib/commerce/size-demand';

const VERDICT_TONE: Record<SizeVerdict, BadgeTone> = {
  buy_more: 'success',
  balanced: 'neutral',
  buy_less: 'warning',
  unknown: 'neutral',
};

const VERDICT_LABEL: Record<SizeVerdict, string> = {
  buy_more: 'Buy more',
  balanced: 'About right',
  buy_less: 'Buy less',
  unknown: 'Too few sales',
};

/** Where 1.0 sits on the bar. An index of 2 fills the track; anything higher
 *  is pinned there rather than rescaling every other bar around one outlier. */
const FULL_SCALE = 2;

export function SizeRunPanel({ sizes }: { sizes: SizeInsight[] }) {
  if (sizes.length === 0) {
    return (
      <p className="p-8 text-center text-text-secondary">
        No sized variants in the catalogue yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-light">
      {sizes.map((size) => {
        const index = size.demandIndex;
        const width = index === null ? 0 : Math.min(100, (index / FULL_SCALE) * 100);

        return (
          <li key={size.size} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-text-primary">{size.size}</span>
                <Badge tone={VERDICT_TONE[size.verdict]}>{VERDICT_LABEL[size.verdict]}</Badge>
                {size.soldOutCount > 0 && (
                  <span className="text-caption-md text-text-secondary">
                    sold out {size.soldOutCount}×
                  </span>
                )}
              </div>
              <span className="text-body-sm text-text-secondary tabular-nums">
                {Math.round(size.sellThrough * 100)}% sold through
                {index !== null && <> · index {index.toFixed(2)}</>}
              </span>
            </div>

            {/* The track. role="img" with a label rather than a progressbar:
                this is a comparison against a baseline, not a task completing,
                and a screen reader is better served by the sentence. */}
            <div
              role="img"
              aria-label={size.recommendation}
              className="relative h-2 rounded-full bg-background-tertiary overflow-hidden"
            >
              <div
                className={
                  size.verdict === 'buy_more'
                    ? 'h-full bg-success'
                    : size.verdict === 'buy_less'
                      ? 'h-full bg-warning'
                      : 'h-full bg-border-strong'
                }
                style={{ width: `${width}%` }}
              />
              {/* Where the average size sits. */}
              <span
                aria-hidden
                className="absolute inset-y-0 w-px bg-text-muted"
                style={{ left: `${100 / FULL_SCALE}%` }}
              />
            </div>

            <p className="text-caption-md text-text-secondary mt-2">{size.recommendation}</p>
          </li>
        );
      })}
    </ul>
  );
}
