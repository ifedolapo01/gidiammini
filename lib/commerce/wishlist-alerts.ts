/**
 * COMMERCE layer — deciding what a saved product has earned an email about.
 *
 * A wishlist is the clearest demand signal a small store gets, and until this
 * existed nothing acted on it. Two things are worth telling somebody:
 *
 *   - what they saved is cheaper than when they saved it;
 *   - what they saved is buyable again.
 *
 * Nothing else. This list is only worth having as long as it is never used as
 * a newsletter, which is the same rule the stock-alert mail is written under.
 *
 * Pure, so the rules can be tested without a database, a mail server or a
 * month of waiting. The sweep that applies them is
 * app/api/cron/wishlist-alerts/route.ts.
 */
import { isRestock } from './stock';

/** One saved row, as the sweep reads it. */
export interface WishlistWatch {
  customerId: string;
  productId: string;
  /** Cheapest price when saved, or when the last drop was announced. Null for
   *  rows saved before any of this existed — the first sweep fills it in. */
  referencePrice: number | null;
  /** Stock as last observed. Null for the same reason. */
  lastSeenStock: number | null;
}

/** What the catalogue says about that product right now. */
export interface WatchedProduct {
  id: string;
  name: string;
  /** The cheapest way to buy it today — `price_min` from product_cards(). */
  price: number;
  stock: number;
}

export type WishlistAlertKind = 'price-drop' | 'back-in-stock';

export interface WishlistAlert {
  kind: WishlistAlertKind;
  customerId: string;
  productId: string;
  productName: string;
  /** What they would pay now. */
  price: number;
  /** What it was when they saved it. Equal to `price` for a restock. */
  referencePrice: number;
}

/**
 * The smallest drop worth an email, as a fraction.
 *
 * ₦20 off a ₦13,000 gown is not news, and mailing it is how a list stops being
 * opened. Five per cent is roughly "you would notice this on the shelf".
 */
export const MIN_PRICE_DROP_RATIO = 0.05;

/** The state to write back after a sweep, sent or not. */
export interface WatchObservation {
  reference_price: number;
  last_seen_stock: number;
}

/**
 * What this row has earned, or null.
 *
 * Back in stock outranks a price drop: one email per product per sweep, and
 * "you can buy it again" is the one that expires — a restock is a race, a
 * lower price is not.
 */
export function decideWishlistAlert(
  watch: WishlistWatch,
  product: WatchedProduct
): WishlistAlert | null {
  const base = {
    customerId: watch.customerId,
    productId: watch.productId,
    productName: product.name,
    price: product.price,
  };

  // A row with nothing observed yet has no baseline to compare against — it
  // was saved before any of this existed, or is being swept for the first
  // time. The sweep records what it sees and says nothing, because inventing a
  // change from a state we never observed mails people about news that did not
  // happen.
  if (watch.lastSeenStock !== null && isRestock(watch.lastSeenStock, product.stock)) {
    return { ...base, kind: 'back-in-stock', referencePrice: watch.referencePrice ?? product.price };
  }

  // Nothing to buy: a cheaper sold-out product is not an offer, and sending it
  // wastes the one email this product had earned.
  if (product.stock <= 0) return null;

  if (watch.referencePrice === null || watch.referencePrice <= 0) return null;

  const threshold = watch.referencePrice * (1 - MIN_PRICE_DROP_RATIO);
  if (product.price > threshold) return null;

  return { ...base, kind: 'price-drop', referencePrice: watch.referencePrice };
}

/**
 * What to store after looking.
 *
 * The baseline moves in exactly two situations: when there was not one, and
 * when a drop has just been announced (it becomes the price announced, so the
 * next email needs a genuinely new low).
 *
 * It deliberately does *not* follow the price down otherwise. If it did, a
 * product sliding down two per cent a week would re-baseline every sweep and
 * never cross the threshold — the customer would never hear that it is now a
 * third cheaper than when they saved it. Nor does it follow the price up: what
 * they saved it at is the number the promise is measured against.
 */
export function observeWatch(
  watch: WishlistWatch,
  product: WatchedProduct,
  alerted: WishlistAlert | null
): WatchObservation {
  const previous = watch.referencePrice;
  const noBaseline = previous === null || previous <= 0;

  return {
    last_seen_stock: product.stock,
    reference_price:
      noBaseline || alerted?.kind === 'price-drop' ? product.price : previous,
  };
}

/** "₦2,000 off" — the drop itself, which is the part worth a subject line. */
export function priceDropAmount(alert: WishlistAlert): number {
  return Math.max(0, alert.referencePrice - alert.price);
}
