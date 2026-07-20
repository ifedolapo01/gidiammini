/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { ShippingZone } from '@/types/shipping';
import NextSteps from './NextSteps';
import OrderDetailsCard from './OrderDetailsCard';
import EstimatedTimeline from './EstimatedTimeline';

interface ConfirmationStepProps {
  orderNumber: string;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    note: string;
  };
  pickupAddress: string;
  total: number;
}

export default function ConfirmationStep({
  orderNumber,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  zones,
  formData,
  pickupAddress,
  total = 0
}: ConfirmationStepProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-surface rounded-surface shadow-elevation-4 border border-success-border p-4 md:p-8 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-success-background rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-success" />
        </div>

        <h2 className="text-h5 md:text-h3 font-bold text-text-primary mb-3 md:mb-4">Order Submitted Successfully!</h2>
        <p className="text-text-secondary text-body-md md:text-body-lg mb-6 md:mb-8">
          We've received your order #{orderNumber}
        </p>

        <NextSteps
          deliveryOption={deliveryOption}
          selectedState={selectedState}
          selectedLga={selectedLga}
          selectedPlace={selectedPlace}
          zones={zones}
          formData={formData}
        />

        <OrderDetailsCard
          orderNumber={orderNumber}
          formData={formData}
          deliveryOption={deliveryOption}
          selectedState={selectedState}
          selectedLga={selectedLga}
          selectedPlace={selectedPlace}
          zones={zones}
          pickupAddress={pickupAddress}
          total={total}
        />

        <EstimatedTimeline
          deliveryOption={deliveryOption}
          selectedState={selectedState}
          selectedLga={selectedLga}
          selectedPlace={selectedPlace}
          zones={zones}
        />

        <div className="space-y-4">
          <Link
            href="/products"
            className="inline-block w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-control font-semibold md:font-bold text-body-md md:text-body-lg hover:bg-primary-hover transition-all"
          >
            Continue Shopping
          </Link>

          <p className="text-caption-md md:text-body-sm text-text-muted mt-3 md:mt-4">
            We'll contact you via email/SMS for updates.<br />
            For urgent inquiries, you can call: <strong>0809 653 9067</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
