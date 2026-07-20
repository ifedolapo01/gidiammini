/** STOREFRONT layer — checkout receipt upload + order/newsletter submission. */
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CartItem, OrderData } from '@/types/order';
import { CheckoutFormData } from './useCheckoutForm';

interface UseOrderSubmissionParams {
  orderNumber: string;
  total: number;
  items: CartItem[];
  formData: CheckoutFormData;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  shippingZoneId?: string | null;
  /** Called after the order is created successfully (clears cart, advances step). */
  onSuccess: () => void;
}

export function useOrderSubmission({
  orderNumber,
  total,
  items,
  formData,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  shippingZoneId,
  onSuccess,
}: UseOrderSubmissionParams) {
  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedReceipt(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendReceipt = async () => {
    if (!uploadedReceipt) {
      alert('Please upload your payment receipt first.');
      return;
    }

    setIsProcessing(true);

    try {
      // Upload receipt to Supabase Storage
      const supabase = createClient();
      const fileName = `${orderNumber}-${Date.now()}.jpg`;

      // Convert base64 to blob
      const base64Response = await fetch(uploadedReceipt);
      const blob = await base64Response.blob();

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Create order in database
      const orderData: OrderData = {
        order_number: orderNumber,
        customer_name: `${formData.firstName} ${formData.lastName}`,
        customer_email: formData.email,
        customer_phone: formData.phone,
        total_amount: total,
        delivery_option: deliveryOption,
        selected_state: selectedState,
        selected_lga: selectedLga || null,
        selected_place: selectedPlace || null,
        shipping_zone_id: shippingZoneId ?? null,
        delivery_address: deliveryOption === 'delivery' ? formData.address : undefined,
        city: formData.city,
        note: formData.note,
        receipt_url: publicUrl,
        items: items.map((item: CartItem) => ({
          product_id: item.productId,
          product_name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size || null,
          color: item.color || null,
        }))
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Parse the response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid response from server');
      }

      if (result.success) {
        // Handle Newsletter Subscription
        if (formData.subscribeToNewsletter) {
          try {
            await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email,
                name: `${formData.firstName} ${formData.lastName}`
              }),
            });
          } catch (e) {
            console.error('Subscription failed but order succeeded', e);
          }
        }

        onSuccess();
      } else {
        throw new Error(result.error || 'Order submission failed');
      }

    } catch (error: any) {
      console.error('Order submission error:', error);
      alert('Failed to submit order. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    uploadedReceipt,
    setUploadedReceipt,
    isProcessing,
    handleReceiptUpload,
    handleSendReceipt,
  };
}
