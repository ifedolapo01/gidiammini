/** STOREFRONT layer — checkout receipt upload + order/newsletter submission. */
import { useState } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/order';
import { CheckoutFormData } from './useCheckoutForm';
import { submitNewsletterOptIn } from './newsletter-opt-in';
import { buildOrderPayload, reportOrderFailure } from './order-request';

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

      // Shared with the online-payment path, which sends the same order with
      // no receipt — see order-request.ts.
      const orderPayload = buildOrderPayload(
        {
          idempotencyKey,
          total,
          items,
          formData,
          deliveryOption,
          selectedState,
          selectedLga,
          selectedPlace,
        },
        receiptPath
      );

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json().catch(() => null);

      if (reportOrderFailure(response, result, { total, onValidationError })) return;

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
