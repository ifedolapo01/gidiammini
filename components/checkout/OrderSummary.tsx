/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Banknote } from 'lucide-react';
import { CartItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getDeliveryLabel } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';
import ProductImage from '@/components/commerce/ProductImage';
import { useStoreSettings } from '@/components/StoreSettingsProvider';
import DiscountCodeField from './DiscountCodeField';
import type { AppliedCode } from './hooks/useCheckoutQuote';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  /** The code box. Rendered in both the desktop sidebar and the mobile
   *  dialog — most of this shop's traffic is a phone, and a discount field
   *  only a desktop can reach is a discount field most customers do not have.
   *  `fieldId` keeps the two inputs distinct. */
  discountCode?: {
    fieldId: string;
    value: string;
    onChange: (value: string) => void;
    applied: AppliedCode | null;
    error: string | null;
    disabled?: boolean;
  };
}

/** Mirrors the payment step's own check — see useCheckoutPayment. */
const onlinePaymentAvailable = process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === 'true';

export default function OrderSummary({
  items,
  subtotal,
  tax,
  shippingCost,
  total,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  zones,
  discountCode
}: OrderSummaryProps) {
  // The rate the shop is actually charging. This line said "Tax (7.5%)" as a
  // literal, which stopped being true the moment the rate became a setting.
  const { taxRate } = useStoreSettings();

  return (
    <div className="bg-surface rounded-surface shadow-elevation-2 border border-border p-4 md:p-6">
      <h2 className="text-body-lg md:text-h5 font-bold mb-4 md:mb-6 text-text-primary">Order Summary</h2>

      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 max-h-64 md:max-h-96 overflow-y-auto pr-2">
        {items.map(item => (
          <div key={item.productId} className="flex items-start justify-between pb-3 md:pb-4 border-b border-border-light">
            <div className="flex items-start space-x-2 md:space-x-3">
              <ProductImage
                src={item.image}
                alt={item.name}
                className="w-12 h-12 md:w-16 md:h-16 rounded-control flex-shrink-0"
                sizes="64px"
              />
              <div>
                <span className="font-medium text-text-primary text-body-sm md:text-body-md">{item.name}</span>
                <div className="text-caption-md md:text-body-sm text-text-secondary mt-1">
                  {item.color && <span>Color: {item.color}</span>}
                  {item.size && <span> • Size: {item.size}</span>}
                  <span> • Qty: {item.quantity}</span>
                </div>
              </div>
            </div>
            <span className="font-semibold text-text-primary text-body-sm md:text-body-md">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2 md:space-y-3 border-t border-border pt-3 md:pt-4 mb-4 md:mb-6">
        <div className="flex justify-between">
          <span className="text-text-secondary text-body-sm md:text-body-md">Subtotal ({items.length} items)</span>
          <span className="font-medium text-text-primary text-body-sm md:text-body-md">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary text-body-sm md:text-body-md">
            {deliveryOption === 'pickup' ? 'Pickup Fee' : 'Delivery Fee'}
            <span className="text-caption-md md:text-body-sm block text-text-muted">
              {selectedState} {deliveryOption === 'pickup' ? 'pickup' : 'delivery'}
            </span>
          </span>
          <span className="font-medium text-text-primary text-body-sm md:text-body-md">
            {formatCurrency(shippingCost)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary text-body-sm md:text-body-md">
            {/* Trailing zeros trimmed: 7.5% reads as a rate, 7.50000% reads as
                a bug. Same treatment as the cart summary. */}
            Tax ({Number((taxRate * 100).toFixed(3))}%)
          </span>
          <span className="font-medium text-text-primary text-body-sm md:text-body-md">{formatCurrency(tax)}</span>
        </div>
      </div>

      {discountCode && (
        <DiscountCodeField
          id={discountCode.fieldId}
          value={discountCode.value}
          onChange={discountCode.onChange}
          applied={discountCode.applied}
          error={discountCode.error}
          disabled={discountCode.disabled}
        />
      )}

      <div className="border-t border-border pt-3 md:pt-4">
        <div className="flex justify-between text-body-lg md:text-h5 font-bold">
          <span className="text-text-primary">Total Amount</span>
          <div className="text-right">
            <div className="text-primary">{formatCurrency(total)}</div>
          </div>
        </div>

        <div className="mt-3 md:mt-4 p-3 bg-background-secondary rounded-surface">
          <div className="flex items-center justify-between text-caption-md md:text-body-sm">
            <span className="text-text-primary">Delivery Method:</span>
            <span className="font-medium capitalize text-text-primary">
              {getDeliveryLabel(deliveryOption, zones, selectedState, 'badge', { lga: selectedLga, place: selectedPlace })}
            </span>
          </div>
          <div className="flex items-center justify-between text-caption-md md:text-body-sm mt-1 md:mt-2">
            <span className="text-text-primary">Location:</span>
            <span className="font-medium text-text-primary">
              {selectedLga ? `${selectedLga}, ${selectedState}` : selectedState}
            </span>
          </div>
        </div>
      </div>

      {/* What the next step will offer. Driven by the same flag the payment step
          reads, so this cannot promise a method that is not there — it said
          "Bank Transfer Only" for a while after online payment shipped. */}
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="flex items-center text-caption-md md:text-body-sm text-text-secondary mb-3 md:mb-4">
          <Banknote className="w-4 h-4 md:w-5 md:h-5 mr-2 text-success" />
          <span className="font-medium">
            {onlinePaymentAvailable ? 'Card, bank transfer or USSD' : 'Bank Transfer Only'}
          </span>
        </div>
        <p className="text-caption-md md:text-body-sm text-text-secondary">
          {onlinePaymentAvailable
            ? 'Pay now and your order is confirmed straight away, or transfer yourself and upload the receipt. You choose at the next step.'
            : "Pay via bank transfer and upload your receipt. We'll verify and process your order."}
        </p>
      </div>
    </div>
  );
}
