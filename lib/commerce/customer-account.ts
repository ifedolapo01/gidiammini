/**
 * COMMERCE layer — the parts of a customer account that are pure decisions.
 *
 * Three of them, and each is a place where getting it slightly wrong is a bug
 * a customer would feel:
 *
 *   1. What the person typed into the sign-in box. Email or phone, and the
 *      phone in any of the four ways Nigerians write one.
 *   2. What we are allowed to tell them about where the link went. Enough to
 *      find the email, not enough to confirm an address exists.
 *   3. What "reorder" means when the catalogue has moved on — a price change,
 *      a sold-out size, a delisted product.
 *
 * No React, no Supabase, so all three are testable directly.
 */
import { isValidEmail } from '@/lib/validation';
import { normalisePhone } from '@/lib/notifications/phone';
import { getVariantPrice, getVariantStock } from './pricing';
import type { CartItem } from '@/types/order';
import type { Product } from '@/types/product';

export type Contact =
  | { kind: 'email'; email: string }
  | { kind: 'phone'; msisdn: string };

/**
 * What the sign-in box was given.
 *
 * Email wins when the value looks like one, because an address is
 * unambiguous. Anything else is tried as a phone number, which is where the
 * normalising matters: 0806…, +234806…, 234806… and 806… are one number.
 */
export function parseContact(input: string): Contact | null {
  const value = input.trim();
  if (!value) return null;

  const email = value.toLowerCase();
  if (isValidEmail(email)) return { kind: 'email', email };

  const phone = normalisePhone(value);
  if (phone.ok) return { kind: 'phone', msisdn: phone.msisdn };

  return null;
}

/**
 * "ad•••@gmail.com" — enough for the customer to know which inbox to open,
 * not enough to hand an address to somebody who guessed at it.
 *
 * The domain stays whole on purpose: knowing it is Gmail rather than Yahoo is
 * most of what makes this useful, and the domain is not the secret.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';

  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, Math.min(local.length - head.length, 6)))}@${domain}`;
}

/** Why a line from the old order could not be added back to the cart. */
export type SkipReason = 'unavailable' | 'out_of_stock';

export interface SkippedLine {
  name: string;
  reason: SkipReason;
}

export interface ReorderResult {
  lines: CartItem[];
  skipped: SkippedLine[];
  /** True when a line came back at a different price than was paid. The cart
   *  should say so rather than let somebody notice at the total. */
  priceChanged: boolean;
}

/** One line of the order being reordered, as stored. */
export interface PastOrderLine {
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

/**
 * Turns the lines of a past order into cart lines at today's prices.
 *
 * Deliberately *not* at the price that was paid. A cart that quotes last
 * month's price is a cart that disagrees with the checkout quote, and the
 * customer discovers that at the total — which is the worst possible moment.
 * The price they paid is still on the old order, where it belongs.
 *
 * Quantity is clamped to what is actually in stock, so a reorder of three
 * where one remains adds one rather than failing the whole basket.
 */
export function buildReorderLines(
  pastLines: PastOrderLine[],
  products: Product[]
): ReorderResult {
  const byId = new Map(products.map((product) => [product.id, product]));

  const lines: CartItem[] = [];
  const skipped: SkippedLine[] = [];
  let priceChanged = false;

  for (const line of pastLines) {
    const product = line.product_id ? byId.get(line.product_id) : undefined;

    // Deleted, delisted, or never linked to a product row in the first place.
    if (!product || product.is_active === false) {
      skipped.push({ name: line.product_name, reason: 'unavailable' });
      continue;
    }

    const stock = getVariantStock(product, line.size ?? '', line.color ?? '');
    if (stock <= 0) {
      skipped.push({ name: line.product_name, reason: 'out_of_stock' });
      continue;
    }

    const price = getVariantPrice(product, line.size ?? '', line.color ?? '');
    if (price !== line.price) priceChanged = true;

    lines.push({
      productId: product.id,
      // The current name, not the one on the order: the cart is about what is
      // being bought now, and a renamed product should read as itself.
      name: product.name,
      price,
      quantity: Math.min(line.quantity, stock),
      image: product.main_image,
      size: line.size ?? undefined,
      color: line.color ?? undefined,
    });
  }

  return { lines, skipped, priceChanged };
}

/** The sentence the cart shows after a reorder. Built here so the two callers
 *  — the account page and its toast — cannot word it differently. */
export function reorderSummary(result: ReorderResult): string {
  const added = result.lines.length;
  const missing = result.skipped.length;

  if (added === 0) {
    return missing > 0
      ? 'Nothing from that order is available right now.'
      : 'That order had nothing to add.';
  }

  const start = `${added} ${added === 1 ? 'item' : 'items'} added to your cart`;
  if (missing === 0) return `${start}.`;

  const soldOut = result.skipped.filter((line) => line.reason === 'out_of_stock').length;
  const gone = missing - soldOut;

  const reasons = [
    soldOut > 0 ? `${soldOut} sold out` : '',
    gone > 0 ? `${gone} no longer available` : '',
  ].filter(Boolean);

  return `${start} — ${reasons.join(', ')}.`;
}
