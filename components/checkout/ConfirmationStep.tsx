/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { CheckCircle, Truck } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';

interface ConfirmationStepProps {
  orderNumber: string;
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
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
  isPickupAvailable,
  selectedState,
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
          Order #{orderNumber} has been sent to store owner
        </p>

        <NextSteps
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
          formData={formData}
          pickupAddress={pickupAddress}
        />

        <OrderDetailsCard
          orderNumber={orderNumber}
          formData={formData}
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
          pickupAddress={pickupAddress}
          total={total}
        />

        <EstimatedTimeline
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
        />

        <div className="space-y-4">
          <Link
            href="/products"
            className="inline-block w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-control font-semibold md:font-bold text-body-md md:text-body-lg hover:bg-primary-hover transition-all"
          >
            Continue Shopping
          </Link>

          <p className="text-caption-md md:text-body-sm text-text-muted mt-3 md:mt-4">
            Store owner will contact you via email/SMS for updates.<br />
            For urgent inquiries, you can call: <strong>0809 653 9067</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function NextSteps({ deliveryOption, isPickupAvailable, selectedState, formData, pickupAddress }: any) {
  return (
    <div className="bg-background-secondary rounded-surface p-4 md:p-6 mb-6 md:mb-8 text-left">
      <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">What Happens Next:</h3>
      <div className="space-y-3 md:space-y-4">
        <StepItem number={1} color="blue">
          <p className="font-medium text-text-primary text-body-sm md:text-body-md">Payment Verification</p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">
            Store owner has received your receipt via email and will verify your bank transfer
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
            {deliveryOption === 'pickup' && isPickupAvailable
              ? 'Pickup Arrangement'
              : selectedState === 'Abuja'
              ? 'Delivery Arrangement'
              : 'Park Drop-off Arrangement'
            }
          </p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">
            {deliveryOption === 'pickup' && isPickupAvailable
              ? `You'll be contacted to arrange pickup from ${pickupAddress}`
              : selectedState === 'Abuja'
              ? `Your items will be delivered to ${formData.address}, ${formData.city}, ${selectedState}`
              : `Your items will be delivered to the specified park in ${selectedState}. We'll contact you with exact park details.`
            }
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

interface OrderDetailsCardProps {
  orderNumber: string;
  formData: ConfirmationStepProps['formData'];
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
  pickupAddress: string;
  total: number;
}

function OrderDetailsCard({
  orderNumber,
  formData,
  deliveryOption,
  isPickupAvailable,
  selectedState,
  pickupAddress,
  total
}: OrderDetailsCardProps) {
  return (
    <div className="bg-info-background border border-info-border rounded-surface p-4 md:p-6 mb-6 md:mb-8">
      <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">Your Order Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-text-primary">
        <DetailItem label="Order Number" value={orderNumber} />
        <DetailItem label="Customer Name" value={`${formData.firstName} ${formData.lastName}`} />
        <DetailItem
          label={deliveryOption === 'pickup' && isPickupAvailable
            ? 'Pickup Location'
            : selectedState === 'Abuja'
            ? 'Delivery Address'
            : 'Park Drop-off Location'
          }
          value={deliveryOption === 'pickup' && isPickupAvailable
            ? pickupAddress
            : `${formData.address}, ${formData.city}, ${selectedState}`
          }
        />
        <DetailItem label="Contact" value={formData.phone} subValue={formData.email} />
      </div>

      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-info-border">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <p className="text-body-sm text-text-secondary">Payment Amount</p>
            <p className="font-bold text-body-lg md:text-h5 text-primary">
              {total ? formatCurrency(total) : '₦0.00'}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <Badge tone="warning">Awaiting Verification</Badge>
            <span className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-caption-md md:text-body-sm font-medium ${
              deliveryOption === 'pickup' && isPickupAvailable
                ? 'bg-info-background text-info'
                : selectedState === 'Abuja'
                ? 'bg-text-primary text-text-inverse'
                : 'bg-background-tertiary text-text-secondary'
            }`}>
              {deliveryOption === 'pickup' && isPickupAvailable
                ? 'Pickup (Abuja Only)'
                : selectedState === 'Abuja'
                ? 'Delivery (Abuja)'
                : 'Park Drop-off'
              } • {selectedState}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, subValue }: any) {
  return (
    <div>
      <p className="text-caption-md md:text-body-sm text-text-secondary">{label}</p>
      <p className="font-bold text-body-sm md:text-body-md">{value}</p>
      {subValue && <p className="text-caption-md md:text-body-sm text-text-primary">{subValue}</p>}
    </div>
  );
}

function EstimatedTimeline({ deliveryOption, isPickupAvailable, selectedState }: any) {
  return (
    <div className="flex items-center bg-background-secondary p-3 md:p-4 rounded-surface mb-6 md:mb-8">
      <Truck className="w-5 h-5 md:w-6 md:h-6 text-info mr-2 md:mr-3" />
      <div>
        <p className="font-medium text-text-primary text-body-sm md:text-body-md">Expected Timeline</p>
        <p className="text-caption-md md:text-body-sm text-text-secondary">
          Payment verification: Within 24 hours<br />
          {deliveryOption === 'pickup' && isPickupAvailable
            ? 'Pickup arrangement'
            : selectedState === 'Abuja'
            ? 'Delivery arrangement'
            : 'Park drop-off arrangement'
          }: 1-2 days after verification
        </p>
      </div>
    </div>
  );
}
