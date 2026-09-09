/**
 * COMMERCE layer — the shape of an RMA number: RA + 8 digits, stamped by the
 * returns_set_rma_number trigger (20260909130000_returns.sql). Mirrors
 * order-number.ts's ORDER_NUMBER_TOKEN/PATTERN shape only, not its reservation
 * machinery — a return has no pre-row-existence deadline to protect (unlike
 * an order number, nothing shows an RMA number before the row exists) and no
 * client-retry-with-idempotency-key scenario, so there is nothing here to
 * reserve.
 */

/** Unanchored, so it can also find an RMA number sitting inside a longer
 *  string — a support email pasted whole, say. */
export const RMA_NUMBER_TOKEN = /RA\d{8}/;
/** The same shape, anchored: true only when the *whole* string is one RMA number. */
export const RMA_NUMBER_PATTERN = new RegExp(`^${RMA_NUMBER_TOKEN.source}$`);
