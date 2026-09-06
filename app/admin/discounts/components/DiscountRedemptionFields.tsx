/** ADMIN layer — the code and the limits on it.
 *
 * A separate block from the targeting fields because it answers a different
 * question. The rest of the form asks "what does this apply to"; this asks
 * "who may use it, and how often". Grouped and explained together, because the
 * fields only make sense as a set — a code with no limits is a code that ends
 * up on a coupon site.
 *
 * Blank means unlimited throughout, matching the nullable columns behind them.
 * That is stated in the hints rather than implied, because the alternative
 * reading — blank means zero, nobody may use it — is the one that costs a
 * campaign.
 */
'use client';

import { Info } from 'lucide-react';
import { Input } from '@/components/ui';
import type { DiscountFormData } from '../hooks/useDiscounts';

interface DiscountRedemptionFieldsProps {
  formData: DiscountFormData;
  setFormData: (data: DiscountFormData) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-body-sm font-semibold text-text-primary mb-1.5">{label}</label>
      {children}
      <p className="mt-1 text-caption-md text-text-secondary">{hint}</p>
    </div>
  );
}

export default function DiscountRedemptionFields({
  formData,
  setFormData,
}: DiscountRedemptionFieldsProps) {
  const hasCode = formData.code.trim() !== '';

  return (
    <div className="rounded-control border border-border bg-background-secondary p-4 space-y-4">
      <Field
        label="Redemption code"
        hint={
          hasCode
            ? 'Only customers who type this get the discount.'
            : 'Leave blank and this discount applies automatically to everyone.'
        }
      >
        <Input
          value={formData.code}
          // Uppercased as it is typed, because that is how it is stored and how
          // the checkout will compare it.
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          placeholder="e.g. WELCOME10 — leave blank for automatic"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
        />
      </Field>

      {/* Only meaningful for a code. An automatic discount applies to every
          eligible order by definition, so a redemption cap on one would be a
          setting that silently does nothing. */}
      {hasCode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Total uses" hint="Blank for unlimited.">
            <Input
              type="number"
              min="1"
              value={formData.max_redemptions}
              onChange={(e) => setFormData({ ...formData, max_redemptions: e.target.value })}
              placeholder="Unlimited"
            />
          </Field>

          <Field label="Uses per customer" hint="Counted by email. Blank for unlimited.">
            <Input
              type="number"
              min="1"
              value={formData.per_customer_limit}
              onChange={(e) => setFormData({ ...formData, per_customer_limit: e.target.value })}
              placeholder="Unlimited"
            />
          </Field>
        </div>
      )}

      <Field
        label="Minimum basket"
        hint="Items subtotal before tax and delivery. 0 for no minimum."
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">₦</span>
          <Input
            type="number"
            min="0"
            className="pl-7"
            value={formData.min_order_value}
            onChange={(e) => setFormData({ ...formData, min_order_value: e.target.value })}
            placeholder="0"
          />
        </div>
      </Field>

      {formData.type === 'FREE_SHIPPING' && (
        <p className="flex items-start gap-2 text-caption-md text-info">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Free delivery waives whatever the customer&apos;s zone charges, so the value field
            above does not apply. Pair it with a minimum basket to make it an offer rather than a
            giveaway.
            {formData.scope !== 'SITEWIDE' && (
              <>
                {' '}
                <strong>
                  Delivery is charged per order, not per item, so a free-delivery discount only
                  applies at sitewide scope.
                </strong>{' '}
                Set the scope to Sitewide or this will never apply.
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
