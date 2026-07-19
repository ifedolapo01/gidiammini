/**
 * ADMIN layer — local currency formatter for the dashboard.
 *
 * Kept local rather than using lib/commerce/pricing.ts's `formatCurrency`:
 * that shared helper renders negative amounts as "₦-5,000" while this
 * Intl-based formatter renders "-₦5,000". Since the visual output genuinely
 * differs for negative amounts, this local copy is preserved as-is.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
