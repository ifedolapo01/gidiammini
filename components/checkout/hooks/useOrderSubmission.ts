/** STOREFRONT layer — checkout receipt upload + order/newsletter submission. */
import { useState } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { CheckoutFormData } from './useCheckoutForm';
import { submitNewsletterOptIn } from './newsletter-opt-in';

interface UseOrderSubmissionParams {
  /** Only used to name the uploaded receipt; the server derives the order's own
   * number from the idempotency key. */
  orderNumber: string;
  /** Identifies this checkout attempt. The server uses it to look up the
   * reserved order number and to make the insert idempotent. */
  idempotencyKey: string;
  /** The total the customer was shown and asked to transfer. Sent for the
   * server to verify against its own pricing — never used as the order's
   * amount, which the server computes itself. */
  total: number;
  items: CartItem[];
  formData: CheckoutFormData;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  /** Called after the order is created successfully (clears cart, advances step). */
  onSuccess: () => void;
  /**
   * Called when the server rejects the submission as invalid. Receives the
   * response body so the caller can pull `fieldErrors` out of it, and should
   * return true if it named a field the customer can correct — in which case
   * the generic error toast is skipped in favour of the highlighted inputs.
   */
  onValidationError?: (body: unknown) => boolean;
}

// NOTE: no shippingZoneId is passed any more. The zone is resolved server-side
// from state/LGA/place by priceOrder(), so the fee stored on the order can't
// come from a zone the client picked.
export function useOrderSubmission({
  orderNumber,
  idempotencyKey,
  total,
  items,
  formData,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  onSuccess,
  onValidationError,
}: UseOrderSubmissionParams) {
  /** Data URL, used only for the on-screen thumbnail. */
  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>(null);
  /** The actual file, which is what gets uploaded. */
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);

    // Preview only. The file itself is posted as multipart form data — reading
    // it into a base64 data URL just to upload it would inflate the payload by
    // a third for no benefit.
    const reader = new FileReader();
    reader.onloadend = () => setUploadedReceipt(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearReceipt = (value: string | null) => {
    setUploadedReceipt(value);
    if (value === null) setReceiptFile(null);
  };

  const handleSendReceipt = async () => {
    if (!receiptFile) {
      toast.error('Please upload your payment receipt first.');
      return;
    }

    setIsProcessing(true);

    try {
      // Upload through the server, which validates the file's type, size and
      // magic bytes and stores it on a random path in a private bucket. The
      // browser never touches storage directly and never learns a URL.
      const receiptForm = new FormData();
      receiptForm.append('receipt', receiptFile);

      const uploadResponse = await fetch('/api/checkout/receipt', { method: 'POST', body: receiptForm });
      const uploadResult = await uploadResponse.json().catch(() => null);

      if (!uploadResponse.ok || !uploadResult?.success) {
        throw new Error(uploadResult?.error || 'We could not upload your receipt. Please try again.');
      }

      const receiptPath: string = uploadResult.path;

      // Describes only *what* is being bought and *where* it's going. Every
      // amount on the resulting order is computed server-side from the
      // catalogue — see lib/commerce/price-order.ts. `expected_total` is the
      // figure the customer was shown, sent purely so the server can refuse
      // the order if its own pricing disagrees.
      const orderPayload = {
        idempotency_key: idempotencyKey,
        customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
        customer_email: formData.email,
        customer_phone: formData.phone,
        expected_total: total,
        delivery_option: deliveryOption,
        selected_state: selectedState,
        selected_lga: selectedLga || null,
        selected_place: selectedPlace || null,
        delivery_address: deliveryOption === 'delivery' ? formData.address : undefined,
        city: formData.city,
        note: formData.note,
        receipt_path: receiptPath,
        items: items.map((item: CartItem) => ({
          product_id: item.productId,
          size: item.size || null,
          color: item.color || null,
          quantity: item.quantity,
        }))
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json().catch(() => null);

      // The server priced this order differently from what the customer was
      // shown. They have already transferred the old amount, so this needs a
      // person: tell them the real total and point them at support rather than
      // quietly recording a different figure.
      if (response.status === 409 && result?.code === 'price_mismatch') {
        const correctedTotal = result.quote?.total;
        toast.error(
          correctedTotal
            ? `The total for this order is now ${formatCurrency(correctedTotal)}, not ${formatCurrency(total)}. Please contact us before paying so we can sort this out.`
            : result.error,
          { duration: 12000 }
        );
        return;
      }

      // A 400 means the body itself was rejected. When the server named the
      // fields, the customer is sent back to the details step with those inputs
      // marked, which is more use than a toast they can't act on.
      if (response.status === 400 && onValidationError?.(result)) {
        toast.error(result?.error || 'Please check the highlighted details and try again.');
        return;
      }

      if (!response.ok || !result) {
        console.error('Order API error:', response.status, result);
        throw new Error(result?.error || `API Error: ${response.status} ${response.statusText}`);
      }

      if (result.success) {
        // After the order, and never able to fail it.
        await submitNewsletterOptIn(formData);

        onSuccess();
      } else {
        throw new Error(result.error || 'Order submission failed');
      }

    } catch (error: any) {
      console.error('Order submission error:', error);
      // Surface the server's own message where there is one — "Only 2 left of
      // Cotton Sleepsuit (0-3m)" is actionable in a way "failed to submit" isn't.
      toast.error(error?.message || 'Failed to submit order. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    uploadedReceipt,
    setUploadedReceipt: clearReceipt,
    isProcessing,
    handleReceiptUpload,
    handleSendReceipt,
  };
}
