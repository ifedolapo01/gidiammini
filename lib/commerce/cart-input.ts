/**
 * COMMERCE layer — the trust boundary for a cart arriving from a browser.
 *
 * Turns arbitrary JSON into a clean list of "what is being bought" tuples, or
 * a message explaining why it can't. Deliberately drops every field it doesn't
 * recognise — notably `price` and `product_name`, which clients like to send
 * and which the server must always resolve from the catalogue itself
 * (see price-order.ts).
 *
 * Pure and dependency-free, so the same parsing runs identically from the
 * quote endpoint and the order-creation endpoint.
 */

/** Per-line ceiling. A boutique never legitimately sells 10,000 of one variant
 * in a single line, and an unbounded quantity is a cheap way to overflow totals. */
export const MAX_LINE_QUANTITY = 99;
/** Ceiling on distinct lines in one order, for the same reason. */
export const MAX_CART_LINES = 50;

export type DeliveryOption = 'pickup' | 'delivery';

/** The only shape a client is allowed to describe a cart line with. */
export interface CartLineInput {
  product_id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

/** Trimmed string, or null for anything empty or non-string. */
export function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Narrows an unknown value to a delivery option, or null. */
export function parseDeliveryOption(value: unknown): DeliveryOption | null {
  return value === 'pickup' || value === 'delivery' ? value : null;
}

/**
 * Normalises and validates a client cart into `CartLineInput[]`, or returns a
 * customer-facing message describing the first problem found.
 */
export function parseCartLines(raw: unknown): CartLineInput[] | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return 'Your cart is empty.';
  }
  if (raw.length > MAX_CART_LINES) {
    return `An order can contain at most ${MAX_CART_LINES} different items.`;
  }

  const lines: CartLineInput[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return 'One of the items in your cart is malformed.';
    }

    const item = entry as Record<string, unknown>;
    const productId = asTrimmedString(item.product_id) ?? asTrimmedString(item.productId);

    if (!productId) {
      return 'One of the items in your cart is missing a product.';
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return `Quantity for each item must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`;
    }

    lines.push({
      product_id: productId,
      size: asTrimmedString(item.size),
      color: asTrimmedString(item.color),
      quantity,
    });
  }

  return lines;
}

/**
 * Merges duplicate lines (same product + size + color) so stock is later
 * checked against total demand rather than per-line demand — two lines of 1
 * against a stock of 1 must fail, and would pass if checked separately.
 */
export function mergeCartLines(lines: CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, CartLineInput>();

  for (const line of lines) {
    const key = `${line.product_id}|${line.size ?? ''}|${line.color ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + line.quantity, MAX_LINE_QUANTITY);
    } else {
      merged.set(key, { ...line });
    }
  }

  return [...merged.values()];
}
