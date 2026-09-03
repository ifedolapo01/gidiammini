/**
 * ADMIN layer — a cost-price input with the margin it implies, shown live.
 *
 * The number on its own is not the useful part. What the admin needs while
 * typing is whether the price they have set actually makes money, so the margin
 * appears beside the field and turns red the moment cost exceeds price.
 *
 * Blank means "not recorded", which is not the same as zero. A zero cost would
 * report the whole sale price as profit and quietly make every margin figure a
 * lie, so an empty field stays null and the margin reads "—".
 */
'use client';

import { unitMarginPercent, marginTone, formatMarginPercent } from '@/lib/commerce/margin';
import { formatCurrency } from '@/lib/commerce/pricing';

const TONE_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-text-muted',
} as const;

interface CostInputProps {
  /** The variant's selling price, for the live margin. */
  price: number;
  cost: number | null | undefined;
  onChange: (cost: number | null) => void;
  /** Compact form for the variant rows; the full form for the single-product
   * block, which has room for a label and the margin in naira. */
  variant?: 'compact' | 'full';
  id?: string;
}

export default function CostInput({ price, cost, onChange, variant = 'compact', id }: CostInputProps) {
  const marginPercent = unitMarginPercent(price, cost ?? null);
  const tone = TONE_CLASS[marginTone(marginPercent)];
  const belowCost = marginPercent !== null && marginPercent < 0;

  const handleChange = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') return onChange(null);
    const parsed = Number(trimmed);
    onChange(Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null);
  };

  const field = (
    <div className={variant === 'full' ? 'relative' : 'relative w-24 sm:w-28'}>
      <span
        aria-hidden="true"
        className={`absolute ${variant === 'full' ? 'left-4' : 'left-2.5'} top-1/2 -translate-y-1/2 text-text-secondary ${variant === 'full' ? 'font-medium' : 'text-caption-md'}`}
      >
        ₦
      </span>
      <input
        id={id}
        type="number"
        min="0"
        step="100"
        // A controlled empty string, not 0 — see the note about blank above.
        value={cost ?? ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={belowCost || undefined}
        placeholder="Cost"
        className={
          variant === 'full'
            ? `w-full border rounded-control pl-8 pr-3 py-2 text-body-md text-text-primary bg-surface ${belowCost ? 'border-destructive' : 'border-border-strong'}`
            : `w-full border rounded-control pl-6 pr-2 py-1.5 text-body-sm text-text-primary bg-surface ${belowCost ? 'border-destructive' : 'border-border-strong'}`
        }
      />
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="flex flex-col">
        {field}
        <span className={`text-caption-md mt-0.5 ${tone}`}>
          {formatMarginPercent(marginPercent)}
          <span className="sr-only"> margin</span>
        </span>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-body-sm font-bold text-text-primary mb-2">
        Cost Price (₦) <span className="text-text-muted font-normal">— optional</span>
      </label>
      {field}
      <p className={`text-body-sm mt-1.5 ${tone}`} role={belowCost ? 'alert' : undefined}>
        {marginPercent === null
          ? 'No cost recorded — margin cannot be shown.'
          : belowCost
            ? `Selling below cost: ${formatCurrency(price - (cost ?? 0))} per unit (${formatMarginPercent(marginPercent)}).`
            : `Margin ${formatMarginPercent(marginPercent)} · ${formatCurrency(price - (cost ?? 0))} per unit.`}
      </p>
    </div>
  );
}
