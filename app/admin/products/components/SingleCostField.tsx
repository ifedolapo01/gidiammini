/**
 * ADMIN layer — the cost field for a product with no variants.
 *
 * Registered with react-hook-form like the price and stock fields beside it,
 * rather than controlled like the per-variant CostInput, so the single-product
 * block stays one consistent form. The margin readout is derived from the
 * watched price and cost, so it moves as either is typed.
 */
'use client';

import { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { unitMarginPercent, marginTone, formatMarginPercent } from '@/lib/commerce/margin';
import { formatCurrency } from '@/lib/commerce/pricing';

const TONE_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-text-muted',
} as const;

interface SingleCostFieldProps {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  watch: UseFormWatch<ProductFormValues>;
}

export default function SingleCostField({ register, errors, watch }: SingleCostFieldProps) {
  const price = Number(watch('price')) || 0;
  const rawCost = watch('cost');
  // An empty field is "not recorded", not zero — so it must not become 0 here.
  const cost = rawCost === '' || rawCost === undefined || rawCost === null ? null : Number(rawCost);

  const marginPercent = unitMarginPercent(price, cost);
  const belowCost = marginPercent !== null && marginPercent < 0;

  return (
    <div>
      <label htmlFor="single-cost" className="block text-body-sm font-bold text-text-primary mb-2">
        Cost Price (₦) <span className="text-text-muted font-normal">— optional</span>
      </label>
      <div className="relative">
        <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">
          ₦
        </span>
        <Input
          id="single-cost"
          {...register('cost')}
          type="number"
          onFocus={(e) => e.target.select()}
          invalid={!!errors.cost || belowCost}
          className="pl-8"
          min="0"
          step="100"
          placeholder="Leave blank if unknown"
        />
      </div>

      {errors.cost ? (
        <p className="text-destructive text-body-sm mt-1.5">{errors.cost.message as string}</p>
      ) : (
        <p className={`text-body-sm mt-1.5 ${TONE_CLASS[marginTone(marginPercent)]}`} role={belowCost ? 'alert' : undefined}>
          {marginPercent === null
            ? 'No cost recorded — margin cannot be shown.'
            : belowCost
              ? `Selling below cost: ${formatCurrency(price - (cost ?? 0))} per unit (${formatMarginPercent(marginPercent)}).`
              : `Margin ${formatMarginPercent(marginPercent)} · ${formatCurrency(price - (cost ?? 0))} per unit.`}
        </p>
      )}
    </div>
  );
}
