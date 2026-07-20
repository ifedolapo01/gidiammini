/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getDeliveryLabel, isPickupAvailable, findShippingZone } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';

interface OrderDetailsCardProps {
  orderNumber: string;
  formData: { firstName: string; lastName: string; phone: string; email: string; address: string; city: string };
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  pickupAddress: string;
  total: number;
}

export default function OrderDetailsCard({
  orderNumber,
  formData,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  zones,
  pickupAddress,
  total
}: OrderDetailsCardProps) {
  const isPickup = deliveryOption === 'pickup' && isPickupAvailable(zones, selectedState, selectedLga, selectedPlace);
  const zone = findShippingZone(zones, selectedState, selectedLga, selectedPlace);
  const isDoorDelivery = !!zone?.is_door_delivery;

  return (
    <div className="bg-info-background border border-info-border rounded-surface p-4 md:p-6 mb-6 md:mb-8">
      <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">Your Order Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-text-primary">
        <DetailItem label="Order Number" value={orderNumber} />
        <DetailItem label="Customer Name" value={`${formData.firstName} ${formData.lastName}`} />
        <DetailItem
          label={getDeliveryLabel(deliveryOption, zones, selectedState, 'detailLabel', { lga: selectedLga, place: selectedPlace })}
          value={isPickup
            ? pickupAddress
            : isDoorDelivery
              ? `${formData.address}, ${formData.city}, ${selectedState}`
              : `${selectedLga ? `${selectedLga}, ` : ''}${selectedState}`
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
              isPickup
                ? 'bg-info-background text-info'
                : 'bg-surface-inverse text-on-inverse'
            }`}>
              {getDeliveryLabel(deliveryOption, zones, selectedState, 'badge', { lga: selectedLga, place: selectedPlace })} • {selectedState}
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
