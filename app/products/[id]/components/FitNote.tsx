/**
 * STOREFRONT layer — "runs small", said where it changes a decision.
 *
 * Two tones, one component, because the same fact belongs in two places and
 * must not be written twice:
 *
 *   * `inline` sits under the size buttons. This is the important one — a
 *     shopper who never opens the size guide still sees that the garment runs
 *     small, at the moment they are choosing a size.
 *   * `panel` sits at the top of the guide, where there is room for the
 *     sentence of specifics as well.
 *
 * "Runs small" alone leaves the parent to work out what to do about it, so the
 * advice that follows from the rating comes with it — see fitAdvice.
 */
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fitAdvice, fitLabel, type FitRating } from '@/lib/commerce/size-guide';

interface FitNoteProps {
  rating?: FitRating | null;
  /** The per-product sentence, when there is one. */
  note?: string | null;
  tone: 'inline' | 'panel';
}

const ICONS = {
  runs_small: ArrowUp,
  true_to_size: Check,
  runs_large: ArrowDown,
} as const;

/** True to size is reassurance; the other two are instructions. */
const COLOURS = {
  runs_small: 'text-warning',
  true_to_size: 'text-success',
  runs_large: 'text-warning',
} as const;

export default function FitNote({ rating, note, tone }: FitNoteProps) {
  if (!rating && !note) return null;

  const Icon = rating ? ICONS[rating] : Check;
  const colour = rating ? COLOURS[rating] : 'text-text-secondary';

  if (tone === 'inline') {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-body-sm">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', colour)} aria-hidden="true" />
        <span className="text-text-secondary">
          {rating && <span className={cn('font-semibold', colour)}>{fitLabel(rating)}</span>}
          {rating && ' — '}
          {rating ? fitAdvice(rating) : note}
        </span>
      </p>
    );
  }

  return (
    <div className="rounded-control border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4 shrink-0', colour)} aria-hidden="true" />
        <span className={cn('text-body-md font-semibold', colour)}>
          {rating ? fitLabel(rating) : 'About the fit'}
        </span>
      </p>
      {rating && <p className="mt-1 text-body-sm text-text-secondary">{fitAdvice(rating)}</p>}
      {note && <p className="mt-1 text-body-sm text-text-secondary">{note}</p>}
    </div>
  );
}
