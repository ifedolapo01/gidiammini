/**
 * COMMERCE layer — the one place major/minor unit conversion happens.
 *
 * Every money column in the database is minor units (e.g. kobo, cents) as of
 * 20260910130000 — see that migration's header for why. This file is the
 * boundary: a human types or reads whole currency ("5000.50"), and everywhere
 * else in the application — API payloads, arithmetic, the database — money
 * stays minor units. A page that needs to show or collect a currency amount
 * converts right at that input or display, not by carrying naira through its
 * own state.
 */

/** Whole currency (e.g. "5000.50" Naira) -> minor units (500050 kobo). */
export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

/** Minor units -> whole currency, for display or for seeding an editable field. */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}
