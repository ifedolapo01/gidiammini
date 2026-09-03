/** COMMERCE layer — shared date formatting, for Admin surfaces and anywhere
 *  the storefront shows a date. */

/**
 * The same instant with its timezone named, for a detail view.
 *
 * The compact form above is deliberately short for a table cell, but that
 * leaves "23:47" ambiguous — an audit entry is evidence, and whoever reads it
 * later may not be in the same timezone as whoever wrote it. This spells out
 * the zone so the reading cannot be off by hours.
 */
export function formatDateWithZone(dateString: string): string {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/** Formats an ISO date string as "15 Jul 2026, 08:30" (en-NG locale). */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * The day only — "15 Jul 2026".
 *
 * For a customer-facing date where the time of day is noise: nobody reading a
 * review cares that it was written at 08:30, and printing it invites the
 * reader to work out how long ago that was instead of reading the review.
 */
export function formatDateOnly(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
