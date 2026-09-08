/**
 * STOREFRONT layer — client-side behavioural event tracking.
 *
 * Every admin analytics panel is computed from orders, which cannot say how
 * many people saw a product before two of them bought it. This queues
 * view_item / add_to_cart / begin_checkout / purchase events and flushes them
 * in small batches to POST /api/events, so the admin funnel has a real
 * denominator instead of none at all.
 *
 * Batched and debounced on purpose: firing one request per event would be a
 * network round trip for every scroll-triggered view, on a storefront that
 * already cares about metered mobile connections (see next.config.ts). A
 * queue plus one flush on page unload costs the same information for a
 * fraction of the requests.
 */
'use client';

const SESSION_STORAGE_KEY = 'gm_events_sid';
const ENDPOINT = '/api/events';
const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH = 20;

export type TrackedEvent = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';

interface QueuedEvent {
  event: TrackedEvent;
  sessionId: string;
  productId?: string | null;
  variantKey?: string | null;
  value?: number | null;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadListenerAttached = false;

/** One id per tab session: reset on tab close, unlike the localStorage id
 *  recently-viewed.ts keeps, because a "session" is what the funnel measures. */
function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Safari private mode denies sessionStorage outright. A per-call id still
    // lets the event through; it just won't group with the rest of the visit.
    return crypto.randomUUID();
  }
}

function send(events: QueuedEvent[], useBeacon: boolean): void {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Fire-and-forget: a dropped analytics batch must never surface to the
    // shopper, who is doing something else entirely.
  });
}

function flush(useBeacon = false): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];
  send(batch, useBeacon);
}

function ensureUnloadFlush(): void {
  if (unloadListenerAttached || typeof window === 'undefined') return;
  unloadListenerAttached = true;
  // pagehide, not beforeunload: it fires on the mobile-Safari "swap tabs" path
  // that beforeunload misses, which is where a checkout tab most often goes.
  window.addEventListener('pagehide', () => flush(true));
}

function enqueue(entry: QueuedEvent): void {
  if (typeof window === 'undefined') return;
  ensureUnloadFlush();

  queue.push(entry);
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
  }
}

export function trackViewItem(productId: string): void {
  enqueue({ event: 'view_item', sessionId: getSessionId(), productId });
}

export function trackAddToCart(productId: string, variantKey: string | null, value: number): void {
  enqueue({ event: 'add_to_cart', sessionId: getSessionId(), productId, variantKey, value });
}

/** One row per checkout, not per line — begin_checkout is a cart-level
 *  milestone in the funnel, not a per-product signal. */
export function trackBeginCheckout(cartValue: number): void {
  enqueue({ event: 'begin_checkout', sessionId: getSessionId(), value: cartValue });
}

export function trackPurchase(
  lines: Array<{ productId: string; variantKey: string | null; value: number }>
): void {
  const sessionId = getSessionId();
  lines.forEach((line) => enqueue({ event: 'purchase', sessionId, ...line }));
}
