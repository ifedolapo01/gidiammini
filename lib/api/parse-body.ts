/**
 * CORE layer — turns an untrusted JSON request body into a typed value, or
 * into a clean 400 naming the offending field.
 *
 * Two problems this replaces:
 *
 *   1. Hand-rolled `if (!body.x?.trim())` checks against `any`. Those read as
 *      validation but only test truthiness: `{"orderNumber": 123}` skips the
 *      guard, then `.trim()` throws a TypeError and the customer gets a 500
 *      reading "Something went wrong."
 *   2. Mass assignment. A schema built from `z.object` strips every key it
 *      doesn't name, so whatever else the body carries cannot reach an insert.
 *      That strip is the allowlist — it is why routes pass parsed data to the
 *      database and never the raw body.
 *
 * The response keeps `error` as a human-readable string, because every existing
 * caller shows it in a toast, and adds `fieldErrors` for forms that can
 * highlight the specific input.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ZodType, ZodError } from 'zod';
import type { FieldErrors } from './field-errors';

export type { FieldErrors };

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Refused before reading the stream. The largest legitimate body is a checkout
 * with MAX_CART_LINES items plus an address, which is a few KB; receipts are
 * multipart on their own route and capped separately in receipt-file.ts.
 */
const MAX_BODY_BYTES = 128 * 1024;

const UNREADABLE = 'We could not read that request. Please try again.';

/** Keeps the first message per field — several complaints about one input are
 * noise, and the first is the one the customer needs to act on. */
function toFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (field in errors) continue;

    // A type mismatch at the root means the body itself is the wrong shape — a
    // bare string, an array, null. zod words that for a developer ("expected
    // object, received null"); a customer gets the same sentence as malformed
    // JSON, because from their side it is the same problem.
    errors[field] = issue.path.length === 0 && issue.code === 'invalid_type'
      ? UNREADABLE
      : issue.message;
  }

  return errors;
}

/**
 * A 400 carrying both a sentence for a toast and the per-field detail.
 *
 * Exported so routes doing a check a schema can't express — one that needs a
 * database read, say — can answer in the same shape.
 */
export function badRequest(fieldErrors: FieldErrors): NextResponse {
  const messages = Object.values(fieldErrors);

  return NextResponse.json(
    {
      success: false,
      // More than a few messages in one toast is unreadable; the form has the
      // rest in fieldErrors.
      error: messages.length > 0 ? messages.slice(0, 3).join(' ') : UNREADABLE,
      fieldErrors,
    },
    { status: 400 }
  );
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<ParsedBody<T>> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'That request is too large.' },
        { status: 413 }
      ),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    // Malformed JSON, an empty body, or the wrong content type. The caller sent
    // something we can't read — that is a 400, not a server error.
    return { ok: false, response: badRequest({ _: UNREADABLE }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: badRequest(toFieldErrors(parsed.error)) };
  }

  return { ok: true, data: parsed.data };
}
