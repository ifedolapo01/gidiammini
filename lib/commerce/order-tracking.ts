/**
 * COMMERCE layer — couriers, waybill numbers, and the link that follows one.
 *
 * WHY MOST OF THESE HAVE NO URL TEMPLATE
 *
 * A tracking link that 404s is worse than no link: the customer clicks it,
 * gets nothing, and messages the shop anyway — which is the exact outcome this
 * whole feature exists to prevent. So a template appears below only for
 * couriers whose public tracking URL is a documented, stable query string.
 * For everyone else the operator pastes the link the courier actually gave
 * them, and that is what gets stored (orders.tracking_url) and emailed.
 *
 * The stored URL is authoritative for the same reason: a courier that changes
 * its URL format next year must not silently break every order already
 * shipped. buildTrackingUrl() is a convenience for the moment of entry, not a
 * read-time derivation.
 *
 * 'self' is in the list because it is how a great many of these parcels
 * actually move — the shop's own rider — and an order that went out on a bike
 * still needs to be marked shipped without inventing a waybill for it.
 */

export interface Carrier {
  /** Stored in orders.carrier. */
  key: string;
  name: string;
  /**
   * Public tracking page, with `{{number}}` where the waybill goes. Absent
   * where the format is not something to bet a customer's click on.
   */
  urlTemplate?: string;
  /** False for a delivery that has no reference at all — the shop's own rider. */
  requiresNumber?: boolean;
}

/** The couriers this shop uses, plus the two ways out of a fixed list. */
export const CARRIERS: readonly Carrier[] = [
  { key: 'gig', name: 'GIG Logistics' },
  { key: 'fez', name: 'Fez Delivery' },
  { key: 'kwik', name: 'Kwik Delivery' },
  { key: 'sendbox', name: 'Sendbox' },
  { key: 'nipost', name: 'NIPOST' },
  { key: 'redstar', name: 'Red Star Express' },
  { key: 'speedaf', name: 'Speedaf' },
  { key: 'dhl', name: 'DHL Express', urlTemplate: 'https://www.dhl.com/ng-en/home/tracking/tracking-express.html?submit=1&tracking-id={{number}}' },
  { key: 'fedex', name: 'FedEx', urlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={{number}}' },
  { key: 'ups', name: 'UPS', urlTemplate: 'https://www.ups.com/track?tracknum={{number}}' },
  { key: 'self', name: 'Our own dispatch rider', requiresNumber: false },
  { key: 'other', name: 'Another courier' },
];

export function findCarrier(key: string | null | undefined): Carrier | undefined {
  return CARRIERS.find((carrier) => carrier.key === key);
}

/** Display name for a stored carrier value. Falls back to the raw string, so a
 * courier typed in by hand still reads as itself rather than as blank. */
export function carrierName(key: string | null | undefined): string {
  if (!key) return '';
  return findCarrier(key)?.name ?? key;
}

/** Whether this courier issues a reference the customer can quote. */
export function carrierNeedsNumber(key: string | null | undefined): boolean {
  return findCarrier(key)?.requiresNumber !== false;
}

/**
 * Waybill numbers as stored.
 *
 * Uppercased and stripped of spaces and the separators couriers print for
 * legibility, because the number a customer reads off a text message and the
 * number printed on the label are routinely spaced differently — and a
 * lookup that depends on which one was typed is a lookup that fails.
 */
export function normaliseTrackingNumber(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').toUpperCase().replace(/[\s\-_]/g, '').trim();
  return cleaned || null;
}

/** Only what can safely become an href. Anything else is discarded rather than
 * stored — see the orders_tracking_url_is_http constraint, which refuses it
 * anyway; this is the friendlier half of the same rule. */
export function sanitiseTrackingUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/**
 * The link for this carrier and number, or null when there is nothing
 * trustworthy to offer.
 *
 * A caller that already has an explicit URL should prefer it: an operator who
 * pasted a link is telling you something this function cannot know.
 */
export function buildTrackingUrl(
  carrierKey: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  const carrier = findCarrier(carrierKey);
  const number = normaliseTrackingNumber(trackingNumber);
  if (!carrier?.urlTemplate || !number) return null;
  return carrier.urlTemplate.replace('{{number}}', encodeURIComponent(number));
}

export interface OrderTracking {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

/** Whether an order has anything worth showing a customer. */
export function hasTracking(tracking: Partial<OrderTracking> | null | undefined): boolean {
  return Boolean(tracking?.carrier || tracking?.trackingNumber || tracking?.trackingUrl);
}

/**
 * One line describing where the parcel is, for an email subject line, an SMS,
 * or a summary row. Returns '' when there is nothing to say, so callers can
 * test it directly.
 */
export function describeTracking(tracking: Partial<OrderTracking> | null | undefined): string {
  if (!tracking) return '';
  const name = carrierName(tracking.carrier);
  const number = tracking.trackingNumber;

  if (name && number) return `${name} — ${number}`;
  if (name) return name;
  if (number) return number;
  return '';
}

/**
 * Normalises whatever an operator submitted into the three columns.
 *
 * The URL is filled in from the template only when one was not supplied, so a
 * pasted link always wins over a generated one.
 */
export function resolveTrackingFields(input: {
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): OrderTracking {
  const carrier = (input.carrier ?? '').trim() || null;
  const trackingNumber = normaliseTrackingNumber(input.trackingNumber);
  const supplied = sanitiseTrackingUrl(input.trackingUrl);

  return {
    carrier,
    trackingNumber,
    trackingUrl: supplied ?? buildTrackingUrl(carrier, trackingNumber),
  };
}
