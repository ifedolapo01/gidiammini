/**
 * COMMERCE layer — when an abandoned cart may be emailed about, and what is in it.
 *
 * Pure, and the reason it is its own module: every rule here is a decision
 * about sending unsolicited mail to somebody who typed their address into a
 * form and then left. Getting one wrong is not a rendering bug, it is a shop
 * that nags — so each is a named function with tests rather than a condition
 * buried in a cron route.
 */

import { getVariantPrice, getVariantStock } from './pricing';
import type { Product } from '@/types/product';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A basket larger than this is not a basket. */
export const MAX_CART_ITEMS = 30;

/** How long after the cart was last touched the first reminder is due. */
export const FIRST_REMINDER_HOURS = 1;

/** And the second. Two, then silence. */
export const SECOND_REMINDER_HOURS = 24;

/**
 * A cart that was last seen this long ago is stale enough to be a new
 * abandonment rather than a continuation of the old one.
 *
 * Without this, somebody who browses every Saturday and buys every third
 * Saturday gets reminded every Saturday, forever, because each visit refreshes
 * the same row. Fourteen days is long enough that a new sequence reads as "you
 * left something behind" rather than as nagging.
 */
export const RESTART_AFTER_DAYS = 14;

export interface CartItemSnapshot {
  product_id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

/**
 * The basket, sanitised.
 *
 * These arrive from a public endpoint reading localStorage, so every field is
 * untrusted: a malformed uuid reaching Postgres is a type error rather than an
 * empty result, and an unbounded quantity is a way to make an email claim
 * somebody was buying nine thousand bibs.
 */
export function sanitiseCartItems(raw: unknown): CartItemSnapshot[] {
  if (!Array.isArray(raw)) return [];

  const items: CartItemSnapshot[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;

    const record = entry as Record<string, unknown>;
    const productId = typeof record.product_id === 'string' ? record.product_id : '';
    if (!UUID.test(productId)) continue;

    const size = typeof record.size === 'string' && record.size.trim() ? record.size.trim().slice(0, 60) : null;
    const color = typeof record.color === 'string' && record.color.trim() ? record.color.trim().slice(0, 60) : null;

    // One line per variant. A duplicate is the same line sent twice, not two.
    const key = `${productId}|${size ?? ''}|${color ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const quantity = Math.trunc(Number(record.quantity));
    items.push({
      product_id: productId.toLowerCase(),
      size,
      color,
      quantity: Number.isFinite(quantity) ? Math.min(Math.max(quantity, 1), 99) : 1,
    });

    if (items.length >= MAX_CART_ITEMS) break;
  }

  return items;
}

/** The row as the sending rules see it. */
export interface AbandonedCartState {
  abandoned_at: string;
  first_sent_at: string | null;
  second_sent_at: string | null;
  recovered_at: string | null;
  opted_out: boolean;
}

/** Which email, if any, this row is due for. */
export type DueReminder = 'first' | 'second' | null;

const hoursSince = (iso: string, now: Date): number =>
  (now.getTime() - new Date(iso).getTime()) / 3_600_000;

/**
 * Whether a reminder is due, and which.
 *
 * Both are measured from `abandoned_at` — the last time the cart was seen —
 * not from when the row was created. Somebody still shopping keeps pushing
 * that forward, so the first email cannot land while they are mid-basket.
 */
export function dueReminder(state: AbandonedCartState, now = new Date()): DueReminder {
  // The three permanent stops. Checked first, because no amount of elapsed
  // time makes any of them sendable.
  if (state.opted_out || state.recovered_at) return null;
  if (state.second_sent_at) return null;

  const idle = hoursSince(state.abandoned_at, now);

  if (!state.first_sent_at) {
    return idle >= FIRST_REMINDER_HOURS ? 'first' : null;
  }

  // The second is due 24 hours after abandonment, not 24 hours after the
  // first — otherwise a late first email drags the second out with it.
  return idle >= SECOND_REMINDER_HOURS ? 'second' : null;
}

/**
 * Whether a cart seen now should start a fresh sequence rather than continue
 * the one this row already had.
 *
 * True only when the last thing that happened to the row is old. `opted_out`
 * is not consulted here on purpose: restarting a sequence for somebody who
 * asked to stop is exactly the mistake this file exists to prevent, and that
 * check belongs where the mail is sent, where it cannot be skipped by a caller
 * who forgot.
 */
export function shouldRestartSequence(
  state: Pick<AbandonedCartState, 'first_sent_at' | 'second_sent_at' | 'recovered_at'>,
  now = new Date()
): boolean {
  const marks = [state.second_sent_at, state.first_sent_at, state.recovered_at].filter(
    (mark): mark is string => Boolean(mark)
  );

  // Nothing has happened yet, so there is no sequence to restart.
  if (marks.length === 0) return false;

  const newest = Math.max(...marks.map((mark) => new Date(mark).getTime()));
  return now.getTime() - newest >= RESTART_AFTER_DAYS * 24 * 3_600_000;
}

/** One line as the reminder email renders it. */
export interface CartEmailLine {
  name: string;
  image: string;
  variant: string | null;
  quantity: number;
  price: number;
}

/**
 * The basket as it stands today, ready to put in an email.
 *
 * Built from the catalogue at send time rather than from the snapshot, for the
 * same reason reorder re-prices: an email that quotes a price the shop no
 * longer charges is a promise it cannot keep, and one that shows a sold-out
 * item is an invitation to a dead end.
 *
 * Anything unavailable is dropped silently. If that leaves nothing, the caller
 * sends no email at all — there is no version of "come back for the thing we
 * no longer have" worth writing.
 */
export function buildCartEmailLines(
  items: CartItemSnapshot[],
  products: Product[]
): { lines: CartEmailLine[]; subtotal: number } {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: CartEmailLine[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product || product.is_active === false) continue;
    if (getVariantStock(product, item.size, item.color) <= 0) continue;

    const price = getVariantPrice(product, item.size, item.color);
    subtotal += price * item.quantity;

    lines.push({
      name: product.name,
      image: product.main_image,
      variant: [item.size, item.color].filter(Boolean).join(' · ') || null,
      quantity: item.quantity,
      price,
    });
  }

  return { lines, subtotal };
}
