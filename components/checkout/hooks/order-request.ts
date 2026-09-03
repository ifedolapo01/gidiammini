/**
 * STOREFRONT layer — what an order submission sends, and what it does when the
 * server says no.
 *
 * Extracted when online payment arrived, because there are now two ways to
 * submit the same order — upload a receipt, or pay at the provider — and they
 * differ in exactly one field. Written twice, the price-mismatch handling
 * would have drifted, and that is the branch nobody tests by hand.
 */
import { toast } from 'sonner';
import { CartItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { CheckoutFormData } from './useCheckoutForm';

export interface OrderRequestArgs {
  idempotencyKey: string;
  /** The total the customer was shown. Sent for the server to disagree with,
   *  never used as the order's amount. */
  total: number;
  items: CartItem[];
  formData: CheckoutFormData;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
}

/**
 * Describes only *what* is being bought and *where* it is going.
 *
 * Every amount on the resulting order is computed server-side from the
 * catalogue — see lib/commerce/price-order.ts. No shipping zone is sent
 * either: it is resolved from state/LGA/place server-side, so the fee cannot
 * come from a zone the client picked.
 */
export function buildOrderPayload(args: OrderRequestArgs, receiptPath?: string) {
  const { formData } = args;

  return {
    idempotency_key: args.idempotencyKey,
    customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
    customer_email: formData.email,
    customer_phone: formData.phone,
    expected_total: args.total,
    delivery_option: args.deliveryOption,
    selected_state: args.selectedState,
    selected_lga: args.selectedLga || null,
    selected_place: args.selectedPlace || null,
    delivery_address: args.deliveryOption === 'delivery' ? formData.address : undefined,
    city: formData.city,
    note: formData.note,
    ...(receiptPath ? { receipt_path: receiptPath } : {}),
    items: args.items.map((item: CartItem) => ({
      product_id: item.productId,
      size: item.size || null,
      color: item.color || null,
      quantity: item.quantity,
    })),
  };
}

interface FailureContext {
  total: number;
  onValidationError?: (body: unknown) => boolean;
}

/**
 * Handles the two rejections that are not just "something went wrong", and
 * says whether it dealt with the response.
 *
 * Returns false for anything it did not recognise, leaving the caller to throw
 * with the server's own message — "Only 2 left of Cotton Sleepsuit (0-3m)" is
 * actionable in a way "failed to submit" is not.
 */
export function reportOrderFailure(
  response: Response,
  result: any,
  { total, onValidationError }: FailureContext
): boolean {
  // The server priced this order differently from what the customer was shown.
  // On the transfer path they may already have sent the old amount, so this
  // needs a person rather than a silent correction.
  if (response.status === 409 && result?.code === 'price_mismatch') {
    const corrected = result.quote?.total;
    toast.error(
      corrected
        ? `The total for this order is now ${formatCurrency(corrected)}, not ${formatCurrency(total)}. Please contact us before paying so we can sort this out.`
        : result.error,
      { duration: 12000 }
    );
    return true;
  }

  // A 400 means the body itself was rejected. When the server named the
  // fields, the customer goes back to the details step with those inputs
  // marked, which is more use than a toast they cannot act on.
  if (response.status === 400 && onValidationError?.(result)) {
    toast.error(result?.error || 'Please check the highlighted details and try again.');
    return true;
  }

  return false;
}
