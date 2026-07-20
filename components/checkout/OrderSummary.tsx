/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Banknote } from 'lucide-react';
import { CartItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getDeliveryLabel } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';

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
}

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
  zones
}: OrderSummaryProps) {

  return (
    <div className="bg-surface rounded-surface shadow-elevation-2 border border-border p-4 md:p-6">
      <h2 className="text-body-lg md:text-h5 font-bold mb-4 md:mb-6 text-text-primary">Order Summary</h2>

      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 max-h-64 md:max-h-96 overflow-y-auto pr-2">
        {items.map(item => (
          <div key={item.productId} className="flex items-start justify-between pb-3 md:pb-4 border-b border-border-light">
            <div className="flex items-start space-x-2 md:space-x-3">
              <img
                src={item.image}
                alt={item.name}
                className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-control"
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
          <span className="text-text-secondary text-body-sm md:text-body-md">Tax (7.5%)</span>
          <span className="font-medium text-text-primary text-body-sm md:text-body-md">{formatCurrency(tax)}</span>
        </div>
      </div>

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

      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="flex items-center text-caption-md md:text-body-sm text-text-secondary mb-3 md:mb-4">
          <Banknote className="w-4 h-4 md:w-5 md:h-5 mr-2 text-success" />
          <span className="font-medium">Bank Transfer Only</span>
        </div>
        <p className="text-caption-md md:text-body-sm text-text-secondary">
          Pay via bank transfer and upload your receipt. We'll verify and process your order.
        </p>
      </div>
    </div>
  );
}
