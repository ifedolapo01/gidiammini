/**
 * COMMERCE layer — a checkout in progress, and what it takes to rebuild one.
 *
 * The three-step flow used to be React state and nothing else, so a refresh, a
 * back gesture, or the app switch a customer makes to copy an account number
 * into their banking app dropped them back to step one — at exactly the moment
 * they leave the page.
 *
 * The step itself lives in the URL. This is the data behind it: everything the
 * payment and confirmation screens need to come back identical, persisted to
 * sessionStorage by useCheckoutDraft.
 *
 * Nothing here is trusted by the server. The order's amounts are computed
 * server-side from the catalogue, and the order number is issued from a
 * sequence keyed by `idempotencyKey` — so a tampered draft can mislead the
 * screen it is rendered on and nothing else. It is still validated field by
 * field, because sessionStorage is writable and a corrupt draft must degrade
 * to "start again" rather than render NaN at a customer.
 */

/** The three phases of a checkout. Lives here rather than in the header that
 *  draws them, so the URL, the draft and the components share one definition. */
export type CheckoutStep = 'form' | 'payment' | 'confirmation';

const STEPS: readonly CheckoutStep[] = ['form', 'payment', 'confirmation'];

export type DeliveryChoice = 'pickup' | 'delivery';

/** The customer-details form. */
export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  note: string;
  subscribeToNewsletter: boolean;
}

export interface CheckoutDraft {
  /** Server-issued, shown as the transfer remark. Display only — see above. */
  orderNumber: string;
  /** The server-confirmed total the customer was asked to transfer. */
  orderTotal: number;
  /**
   * The one field that must survive a refresh for correctness rather than
   * convenience: the order number is reserved against this key, so minting a
   * fresh one would issue a second number and leave the customer's transfer
   * remark pointing at nothing.
   */
  idempotencyKey: string;
  formData: CheckoutFormData;
  deliveryOption: DeliveryChoice;
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
}

/** The half of a draft that is not the pending order itself: what the customer
 *  typed and where it is going. The flow owns these, so it hands them over
 *  when asking for the draft to be kept current. */
export type CheckoutDraftDetails = Pick<
  CheckoutDraft,
  'formData' | 'deliveryOption' | 'selectedState' | 'selectedLga' | 'selectedPlace'
>;

export const CHECKOUT_DRAFT_KEY = 'gidiammini_checkout_draft';

/** Bumped when the shape changes; an older draft is discarded rather than
 *  half-read. */
const DRAFT_VERSION = 1;

/** The `?step=` value, or null when it is absent or not one of the three. */
export function parseCheckoutStep(raw: string | null | undefined): CheckoutStep | null {
  return STEPS.includes(raw as CheckoutStep) ? (raw as CheckoutStep) : null;
}

export function serializeCheckoutDraft(draft: CheckoutDraft): string {
  return JSON.stringify({ version: DRAFT_VERSION, ...draft });
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseFormData(raw: unknown): CheckoutFormData {
  const source = (raw ?? {}) as Record<string, unknown>;

  return {
    firstName: str(source.firstName),
    lastName: str(source.lastName),
    email: str(source.email),
    phone: str(source.phone),
    address: str(source.address),
    city: str(source.city),
    note: str(source.note),
    subscribeToNewsletter: source.subscribeToNewsletter === true,
  };
}

/**
 * A draft worth restoring, or null. Null means "start this checkout again",
 * which is the pre-existing behaviour and always safe.
 */
export function parseCheckoutDraft(raw: string | null | undefined): CheckoutDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const draft = parsed as Record<string, unknown>;
  if (draft.version !== DRAFT_VERSION) return null;

  const orderNumber = str(draft.orderNumber).trim();
  const idempotencyKey = str(draft.idempotencyKey).trim();
  const orderTotal = Number(draft.orderTotal);

  // Without all three there is no pending order to return to.
  if (!orderNumber || !idempotencyKey) return null;
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return null;

  return {
    orderNumber,
    orderTotal,
    idempotencyKey,
    formData: parseFormData(draft.formData),
    deliveryOption: draft.deliveryOption === 'delivery' ? 'delivery' : 'pickup',
    selectedState: str(draft.selectedState),
    selectedLga: str(draft.selectedLga),
    selectedPlace: str(draft.selectedPlace),
  };
}
