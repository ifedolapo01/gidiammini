/**
 * COMMERCE-adjacent, pure — turning whatever text an OCR pass pulled off a
 * receipt image into a best-effort guess at the amount and reference a
 * verifier would otherwise type by hand. Kept apart from the hook that runs
 * Tesseract (app/admin/payments/hooks/useReceiptOcr.ts) so this half — the
 * only half with any real logic in it — is unit-testable without a browser.
 *
 * Every guess here is a suggestion, never a decision: the caller always shows
 * it in an editable field the verifier can overwrite before either submit
 * button is pressed.
 */

/** A Naira-shaped number: digit groups optionally comma-separated, optional
 *  kobo. Matches "23,500.00", "23500", "23,500,000". */
const AMOUNT_TOKEN = /\d+(?:,\d{3})*(?:\.\d{1,2})?/g;

/** Long digit runs — the shape of a bank's own transaction reference. */
const DIGIT_RUN = /\d{9,}/g;

function parseAmountToken(token: string): number {
  return Number(token.replace(/,/g, ''));
}

/**
 * The number in `text` closest to `expected`, within 20% of it — close enough
 * to be worth suggesting, far enough off (an account number, a date, a phone
 * number) that a wild non-match is silently withheld rather than offered
 * with false confidence.
 */
export function extractAmountGuess(text: string, expected: number): number | null {
  if (!(expected > 0)) return null;

  const candidates = [...text.matchAll(AMOUNT_TOKEN)]
    .map((match) => parseAmountToken(match[0]))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  if (candidates.length === 0) return null;

  const closest = candidates.reduce((best, amount) =>
    Math.abs(amount - expected) < Math.abs(best - expected) ? amount : best
  );

  return Math.abs(closest - expected) <= expected * 0.2 ? closest : null;
}

/**
 * A reference to suggest. `knownReferences` (the order's own payment
 * reference and order number, say) are checked first and win outright if
 * either appears verbatim — that is the highest-confidence match there is.
 * Otherwise, the longest run of 9+ digits: the shape a bank's own reference
 * usually takes, and the longest run is the one least likely to be a partial
 * account or phone number cut off by a line break.
 */
export function extractReferenceGuess(text: string, knownReferences: string[]): string | null {
  const upper = text.toUpperCase();
  for (const known of knownReferences) {
    if (known && upper.includes(known.toUpperCase())) return known;
  }

  const runs = text.match(DIGIT_RUN);
  if (!runs || runs.length === 0) return null;

  return runs.reduce((longest, run) => (run.length > longest.length ? run : longest));
}
