/**
 * CORE layer — the shape of a validation failure, shared by the API routes that
 * produce one and the forms that display it.
 *
 * Lives apart from parse-body.ts so a client component can import the type and
 * the reader without pulling `next/server` into the browser bundle.
 */

/**
 * Field path to its message. The path is how the schema names the field, so a
 * nested one arrives dotted: `details.deliveryAddress`, `items.0.quantity`.
 */
export type FieldErrors = Record<string, string>;

/** A `success: false` API response that may carry per-field detail. */
interface ErrorResponse {
  error?: unknown;
  fieldErrors?: unknown;
}

/**
 * Pulls `fieldErrors` out of a response body, dropping anything that isn't a
 * string message. Returns `{}` rather than throwing, because a form must still
 * render its generic error when the server didn't send field detail (a 500, a
 * rate limit, an older deployment).
 */
export function readFieldErrors(body: unknown): FieldErrors {
  const raw = (body as ErrorResponse | null)?.fieldErrors;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const errors: FieldErrors = {};
  for (const [field, message] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof message === 'string' && message.length > 0) {
      errors[field] = message;
    }
  }

  return errors;
}

/**
 * Checkout: server field to the input on the details step.
 *
 * `customer_name` is the interesting one — the form collects a first and last
 * name and sends them joined, so a complaint about the combined value has to be
 * shown against an input the customer can actually see.
 */
export const CHECKOUT_FIELD_MAP: Record<string, string> = {
  customer_name: 'firstName',
  customer_email: 'email',
  customer_phone: 'phone',
  delivery_address: 'address',
  city: 'city',
  note: 'note',
};

/**
 * Order change requests: the type-specific fields are nested under `details` in
 * the request body, so the server names them `details.preferredDate` and so on.
 * Those names are unique across the three request types, so one flat map serves
 * all three forms.
 *
 * Deliberately absent: `orderNumber`, `contact` and `requestType`, which come
 * from the tracked order rather than an input. A complaint about those is not
 * something the customer can fix in the form, so it keeps its own key and
 * surfaces through the general error message instead.
 */
export const CHANGE_REQUEST_FIELD_MAP: Record<string, string> = {
  'details.preferredDate': 'preferredDate',
  'details.deliveryAddress': 'deliveryAddress',
  'details.city': 'city',
  'details.newDeliveryOption': 'newDeliveryOption',
};

/**
 * Renames server field paths to the names a form uses for its inputs.
 *
 * The two rarely match: the checkout collects `firstName`/`lastName` and sends
 * one `customer_name`, so a complaint about that field has to be shown against
 * an input the customer can actually see. Anything unmapped is kept under its
 * original key, so a new server field still surfaces somewhere rather than
 * vanishing.
 */
export function mapFieldErrors(errors: FieldErrors, mapping: Record<string, string>): FieldErrors {
  const mapped: FieldErrors = {};

  for (const [field, message] of Object.entries(errors)) {
    const target = mapping[field] ?? field;
    // First message wins, matching the server's own rule when two server
    // fields map onto one input.
    if (!(target in mapped)) {
      mapped[target] = message;
    }
  }

  return mapped;
}
