/**
 * Request schema for POST /api/events — the storefront's behavioural funnel.
 *
 * Batched: the client queues events and flushes several at once, so the
 * payload is an array rather than one event per request. Capped at 20, which
 * is more than one batch window (lib/commerce/storefront-events.ts) ever
 * accumulates — a longer array is not a real client, it's a script.
 */
import { z } from 'zod';

const EVENT_TYPES = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'] as const;

const eventEntrySchema = z.object({
  event: z.enum(EVENT_TYPES),
  /** The client's own anon id, hashed server-side before it ever reaches the
   *  database — see lib/api/session-hash.ts. */
  sessionId: z.string().trim().min(8).max(200),
  productId: z.string().uuid().optional().nullable(),
  variantKey: z.string().trim().max(200).optional().nullable(),
  value: z.number().finite().nonnegative().optional().nullable(),
});

export const trackEventsSchema = z.object({
  events: z.array(eventEntrySchema).min(1).max(20),
});

export type TrackEventsBody = z.infer<typeof trackEventsSchema>;
export type TrackEventEntry = z.infer<typeof eventEntrySchema>;
