/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { getDeliveryLabel, getDeliveryDescription } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';

interface NextStepsProps {
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  formData: { address: string; city: string };
}

export default function NextSteps({ deliveryOption, selectedState, selectedLga, selectedPlace, zones, formData }: NextStepsProps) {
  return (
    <div className="bg-background-secondary rounded-surface p-4 md:p-6 mb-6 md:mb-8 text-left">
      <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">What Happens Next:</h3>
      <div className="space-y-3 md:space-y-4">
        <StepItem number={1} color="blue">
          <p className="font-medium text-text-primary text-body-sm md:text-body-md">Payment Verification</p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">
            We've received your receipt and will verify your bank transfer
          </p>
        </StepItem>

        <StepItem number={2} color="yellow">
          <p className="font-medium text-text-primary text-body-sm md:text-body-md">Order Confirmation</p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">
            You'll receive an email/SMS when your order is confirmed
          </p>
        </StepItem>

        <StepItem number={3} color="green">
          <p className="font-medium text-text-primary text-body-sm md:text-body-md">
            {getDeliveryLabel(deliveryOption, zones, selectedState, 'arrangementTitle', { lga: selectedLga, place: selectedPlace })}
          </p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">
            {getDeliveryDescription(deliveryOption, zones, selectedState, {
              address: formData.address,
              city: formData.city,
              lga: selectedLga,
              place: selectedPlace,
            })}
          </p>
        </StepItem>
      </div>
    </div>
  );
}

type StepColor = 'blue' | 'yellow' | 'green';

function StepItem({ number, color, children }: {
  number: number;
  color: StepColor;
  children: React.ReactNode
}) {
  const colorClasses = {
    blue: 'bg-info-background text-info',
    yellow: 'bg-warning-background text-warning',
    green: 'bg-success-background text-success'
  };

  return (
    <div className="flex items-start">
      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center mr-2 md:mr-3 flex-shrink-0 ${colorClasses[color]}`}>
        {number}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
