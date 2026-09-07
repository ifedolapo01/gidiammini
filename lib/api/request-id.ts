/**
 * CORE layer — the identifier that ties a customer's complaint to a log line.
 *
 * "My order failed yesterday evening" is unanswerable against a wall of
 * unstructured logs. An id shown on the error screen and stamped on every log
 * line for that request turns it into one query.
 *
 * WHERE THE ID COMES FROM
 *
 * Vercel and most proxies already set `x-request-id` (or `x-vercel-id`) on the
 * inbound request. Reusing theirs means our line and the platform's own access
 * log carry the same value, which is the whole point; a fresh one is generated
 * only when nothing upstream provided one.
 */
import { logger, type Logger } from '@/lib/logger';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Short, unambiguous when read aloud over the phone, and not a secret. */
function generateId(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
}

/** The inbound id if there is one, otherwise a new one. */
export function requestIdFrom(request: Request): string {
  const forwarded = request.headers.get(REQUEST_ID_HEADER) ?? request.headers.get('x-vercel-id');
  // A proxy id can be long and path-ish; the tail is the distinguishing part.
  if (forwarded) return forwarded.slice(-36);
  return generateId();
}

/** The id plus a logger already stamped with it — what a route handler wants. */
export function requestContext(request: Request): { requestId: string; log: Logger } {
  const requestId = requestIdFrom(request);
  return {
    requestId,
    log: logger.child({
      requestId,
      method: request.method,
      // Path only. The query string carries search terms, emails and order
      // numbers, none of which belong in a log by default.
      path: new URL(request.url).pathname,
    }),
  };
}

/**
 * The response body for a failure, carrying the id the customer can quote.
 * Deliberately says nothing about what actually went wrong — that is in the
 * log, under this id.
 */
export function errorBody(message: string, requestId: string) {
  return { success: false, error: message, requestId };
}

/** Headers echoing the id, so it is visible in the network tab too. */
export function requestIdHeaders(requestId: string): HeadersInit {
  return { [REQUEST_ID_HEADER]: requestId };
}
