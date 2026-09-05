/**
 * ADMIN layer — turning a date picker's value into the instant a payment
 * arrived.
 *
 * Small, and worth its own file because getting it wrong is invisible. A
 * `<input type="date">` yields "2026-09-05" with no time and no zone;
 * `new Date("2026-09-05")` parses that as midnight UTC, which in a timezone
 * behind UTC is the day before. A payment received on the 5th filed under the
 * 4th does not reconcile against a bank statement, and nobody notices until it
 * has to.
 *
 * So: today keeps the actual time of day — the receipt is being verified now
 * and the extra precision is free — and any earlier date is anchored at local
 * midday, which cannot shift across a day boundary in any real timezone.
 */

/** Today, as a `<input type="date">` value in the operator's own timezone. */
export function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The instant to record, from a date-input value. */
export function toReceivedAt(dateValue: string): string {
  if (!dateValue) return new Date().toISOString();
  if (dateValue === todayInputValue()) return new Date().toISOString();

  // Parsed as local time by leaving the zone off a date-time string, then
  // pinned to midday so no offset can move it onto another day.
  const anchored = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(anchored.getTime()) ? new Date().toISOString() : anchored.toISOString();
}
