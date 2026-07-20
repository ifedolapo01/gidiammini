/** ADMIN layer — tiny cross-component invalidation signal. Fired when order
 * data changes so unrelated views (e.g. the alerts ticker's pending-orders
 * count) can refetch immediately instead of waiting for their next poll. */

const ORDERS_CHANGED_EVENT = 'admin:orders-changed';

export function notifyOrdersChanged() {
  window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
}

export function onOrdersChanged(callback: () => void): () => void {
  window.addEventListener(ORDERS_CHANGED_EVENT, callback);
  return () => window.removeEventListener(ORDERS_CHANGED_EVENT, callback);
}
