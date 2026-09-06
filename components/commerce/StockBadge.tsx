/** COMMERCE layer — shared stock-status badge. Used by Storefront and Admin. */
import { Badge, type BadgeVariant } from '@/components/ui';
import { getStockStatus } from '@/lib/commerce/stock';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';

interface StockBadgeProps {
  stock: number;
  /** The shop's setting. Callers inside the storefront read it from
   *  useStoreSettings(); admin callers from useAdminStoreSettings(). Omitted
   *  falls back to the same value the settings row defaults to. */
  lowStockThreshold?: number;
  variant?: BadgeVariant;
  /** Hide the badge entirely when stock is healthy (default true). */
  hideWhenInStock?: boolean;
  labels?: { in?: string; low?: string; out?: string };
  /** How to render the numeric count alongside the label. */
  countFormat?: 'none' | 'parens' | 'colon' | 'units';
  className?: string;
}

export function StockBadge({
  stock,
  lowStockThreshold = DEFAULT_STORE_SETTINGS.lowStockThreshold,
  variant = 'solid',
  hideWhenInStock = true,
  labels,
  countFormat = 'none',
  className,
}: StockBadgeProps) {
  const status = getStockStatus(stock, lowStockThreshold);

  if (status.level === 'in' && hideWhenInStock) return null;

  // tabular-nums on the count wherever it appears, so a column of these
  // badges lines its digits up down the page. Applied here rather than in each
  // table's cell, because the badge is the only thing that knows where the
  // number is.
  if (countFormat === 'units') {
    return (
      <Badge tone={status.tone} variant={variant} className={className}>
        <span className="tabular-nums">{stock}</span> units
      </Badge>
    );
  }

  const label =
    status.level === 'out' ? (labels?.out ?? status.text)
    : status.level === 'low' ? (labels?.low ?? status.text)
    : (labels?.in ?? status.text);

  const suffix =
    countFormat === 'parens' ? ` (${stock})`
    : countFormat === 'colon' && status.level === 'low' ? `: ${stock}`
    : '';

  return (
    <Badge tone={status.tone} variant={variant} className={className}>
      {label}
      {suffix && <span className="tabular-nums">{suffix}</span>}
    </Badge>
  );
}
