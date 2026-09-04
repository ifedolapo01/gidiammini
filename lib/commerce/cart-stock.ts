/**
 * COMMERCE layer — is what's in the cart still buyable?
 *
 * Pure, and split into two steps so the answer can outlive the query that
 * produced it: `cartStockSnapshot` reduces catalogue rows to "stock on hand
 * per cart line", and `findCartStockIssues` compares a snapshot against the
 * quantities currently in the cart. The cart page takes one snapshot on mount
 * and re-derives issues as the shopper edits quantities; the checkout gate
 * takes a fresh one at the step-1 -> step-2 transition.
 *
 * The wording lives here too, and price-order.ts's server-side rejection uses
 * it, so the cart page, the checkout gate and the API all describe the same
 * sold-out line with the same sentence.
 */
import type { CartItem } from '@/types/order';
import type { Product } from '@/types/product';
import { cartLineKey } from './cart-input';
import { getVariantStock } from './pricing';

/** The catalogue columns a stock check needs. Variants must be embedded —
 * getVariantStock prefers them, and dropping them silently falls back to the
 * legacy pricing_config maps. */
export type CartStockProduct = Pick<Product, 'id' | 'stock'> &
  Partial<Pick<Product, 'pricing_config' | 'product_variants'>>;

/** Stock for a line whose product is not in the catalogue at all — deleted or
 * deactivated — which is a different message from a stock of zero. */
export const PRODUCT_GONE = -1;

/** Stock on hand for each cart line, keyed by `cartLineKey`. */
export function cartStockSnapshot(
  items: CartItem[],
  products: CartStockProduct[]
): Map<string, number> {
  const byId = new Map(products.map((product) => [product.id, product]));
  const snapshot = new Map<string, number>();

  for (const item of items) {
    const product = byId.get(item.productId);
    snapshot.set(
      cartLineKey(item.productId, item.size, item.color),
      product
        ? getVariantStock(product as Product, item.size ?? null, item.color ?? null)
        : PRODUCT_GONE
    );
  }

  return snapshot;
}

export interface CartStockIssue {
  /** `cartLineKey` of the affected line, so a caller can flag that one row. */
  key: string;
  name: string;
  size: string | null;
  color: string | null;
  /** What the cart is asking for. */
  quantity: number;
  /** Stock on hand, or PRODUCT_GONE. */
  available: number;
}

/**
 * Every cart line the snapshot cannot fulfil, in cart order. A line the
 * snapshot says nothing about is left alone rather than reported: not knowing
 * is not the same as knowing it is sold out.
 */
export function findCartStockIssues(
  items: CartItem[],
  snapshot: Map<string, number>
): CartStockIssue[] {
  const issues: CartStockIssue[] = [];

  for (const item of items) {
    const key = cartLineKey(item.productId, item.size, item.color);
    const available = snapshot.get(key);
    if (available === undefined || available >= item.quantity) continue;

    issues.push({
      key,
      name: item.name,
      size: item.size ?? null,
      color: item.color ?? null,
      quantity: item.quantity,
      available,
    });
  }

  return issues;
}

/** "Ribbed Bodysuit (S / red)", or just the name for an unvaried product. */
function lineLabel(line: Pick<CartStockIssue, 'name' | 'size' | 'color'>): string {
  const variant = [line.size, line.color].filter(Boolean).join(' / ');
  return variant ? `${line.name} (${variant})` : line.name;
}

/** One customer-facing sentence for a line that cannot be fulfilled. */
export function describeStockShortage(
  line: Pick<CartStockIssue, 'name' | 'size' | 'color' | 'available'>
): string {
  const label = lineLabel(line);

  if (line.available === PRODUCT_GONE) return `${label} is no longer available.`;
  if (line.available <= 0) return `${label} has just sold out.`;
  return `Only ${line.available} left of ${label}.`;
}
