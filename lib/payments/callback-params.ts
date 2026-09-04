/**
 * PAYMENTS — reading the reference off the provider's return URL.
 *
 * Small, and it exists because getting it wrong looked exactly like a failed
 * payment. Paystack appends BOTH `reference` and `trxref` to whatever callback
 * URL it is given. When that URL already carried a `reference` of our own, the
 * customer came back to `?reference=X&trxref=X&reference=X` — and Next hands a
 * repeated query parameter over as a string[], not a string. The array reached
 * the verify call, was encoded as "X,X", the provider had never heard of it,
 * and a customer whose money had gone through was told "we have not seen that
 * payment".
 *
 * The callback URL no longer carries a reference at all, so this should never
 * see a duplicate again. It handles one anyway: links already sent out live in
 * inboxes, and a provider is free to add parameters we did not ask for.
 */

type Param = string | string[] | undefined;

/** First value wins. A repeated parameter is the same reference twice; if it
 *  ever is not, the first is the one we put there. */
function first(value: Param): string | null {
  if (Array.isArray(value)) return value.find((entry) => entry?.trim()) ?? null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The transaction reference, from either name the provider uses.
 *
 * `trxref` is the fallback rather than the primary because `reference` is the
 * one we chose and the one stored on the order; they carry the same value.
 */
export function paymentReferenceFrom(params: {
  reference?: Param;
  trxref?: Param;
}): string | null {
  return first(params.reference) ?? first(params.trxref);
}
