/**
 * COMMERCE layer — reconciling a browser's cart with the account's.
 *
 * Unlike the wishlist merge (a pure union — see wishlist-sync.ts for why),
 * a cart line carries a quantity, so two devices can disagree about the *same*
 * line rather than just about which lines exist. The rule here is the MAX of
 * the two quantities, not the sum: two devices that each independently hold
 * "2 of this romper" almost never mean "put 4 in the basket" — one of them is
 * simply behind, not additive. This is deliberately a different function from
 * cart-input.ts's mergeCartLines, which sums duplicate lines within a single
 * cart at checkout time (collapsing "added twice" into "wanted twice") — that
 * is a different problem with a different correct answer.
 *
 * Pure, so the merge is testable without a browser or a database.
 */
import type { Product } from '@/types/product';
import type { CartItem } from '@/types/order';
import { getVariantPrice, getVariantStock } from './pricing';
import {
  cartLineKey,
  parseCartLines,
  MAX_LINE_QUANTITY,
  MAX_CART_LINES,
  type CartLineInput,
} from './cart-input';

/**
 * Untrusted JSON from a sync POST, turned into clean cart lines.
 *
 * A malformed or oversized local cart must never fail the sync — it would
 * strand a signed-in customer on an empty cart for a mistake that isn't
 * theirs to fix. So this returns `[]` instead of an error message, unlike
 * parseCartLines (which is used where a bad cart is the customer's own
 * checkout attempt, and telling them what's wrong is the point).
 */
export function sanitiseCartLines(raw: unknown): CartLineInput[] {
  const parsed = parseCartLines(raw);
  return Array.isArray(parsed) ? parsed.slice(0, MAX_CART_LINES) : [];
}

/**
 * The union, keyed by product + size + color, taking the larger quantity
 * where both sides hold the same line. Server entries first, then any
 * local-only line appended — same "server is curated, local is newer"
 * ordering as mergeWishlists.
 */
export function mergeCartsMax(
  serverLines: CartLineInput[],
  localLines: CartLineInput[]
): CartLineInput[] {
  const merged = new Map<string, CartLineInput>(
    serverLines.map((line) => [cartLineKey(line.product_id, line.size, line.color), { ...line }])
  );

  for (const line of localLines) {
    const key = cartLineKey(line.product_id, line.size, line.color);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.min(Math.max(existing.quantity, line.quantity), MAX_LINE_QUANTITY);
    } else {
      merged.set(key, { ...line });
    }
  }

  return [...merged.values()];
}

/**
 * What actually changed relative to what's stored, so a sync only writes the
 * delta instead of rewriting every row on every page load — same rationale as
 * wishlist-sync.ts's idsToAdd, extended to also catch a quantity change on an
 * already-stored line (a wishlist entry has no other field that can change).
 */
export function linesToUpsert(
  serverLines: CartLineInput[],
  mergedLines: CartLineInput[]
): CartLineInput[] {
  const serverByKey = new Map(
    serverLines.map((line) => [cartLineKey(line.product_id, line.size, line.color), line])
  );

  return mergedLines.filter((line) => {
    const existing = serverByKey.get(cartLineKey(line.product_id, line.size, line.color));
    return !existing || existing.quantity !== line.quantity;
  });
}

/**
 * Cart lines, priced and named from today's catalogue — never from anything
 * stored alongside the line itself, per this file's header comment.
 *
 * A line whose product is inactive or currently out of stock for that variant
 * is dropped from the result, same posture as buildCartEmailLines: showing it
 * would let a customer "check out" something that can't actually be sold.
 * It is not deleted from storage by this function — only the caller decides
 * that — so a temporarily out-of-stock line can reappear once restocked.
 */
export function resolveCartLines(lines: CartLineInput[], products: Product[]): CartItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: CartItem[] = [];

  for (const line of lines) {
    const product = byId.get(line.product_id);
    if (!product || product.is_active === false) continue;
    if (getVariantStock(product, line.size, line.color) <= 0) continue;

    items.push({
      productId: product.id,
      name: product.name,
      price: getVariantPrice(product, line.size, line.color),
      quantity: line.quantity,
      image: product.main_image,
      size: line.size ?? undefined,
      color: line.color ?? undefined,
    });
  }

  return items;
}
