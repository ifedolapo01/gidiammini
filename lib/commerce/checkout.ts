/** COMMERCE layer — shared checkout delivery/fee logic. Used by Storefront checkout flow. */

export const TAX_RATE = 0.075;
export const PICKUP_ADDRESS = 'Suite 5, XYZ Plaza, Central Business District, Abuja';

export type DeliveryOption = 'pickup' | 'delivery';

/** Flat delivery fee by state — Abuja is subsidized, everywhere else pays the standard rate. */
export function getDeliveryFee(state: string): number {
  return state === 'Abuja' ? 3000 : 5000;
}

/** Store pickup is only offered in Abuja. */
export function isPickupAvailable(state: string): boolean {
  return state === 'Abuja';
}

type DeliveryMethod = 'pickup' | 'abuja' | 'park';

function resolveDeliveryMethod(
  deliveryOption: DeliveryOption,
  pickupAvailable: boolean,
  selectedState: string
): DeliveryMethod {
  if (deliveryOption === 'pickup' && pickupAvailable) return 'pickup';
  if (selectedState === 'Abuja') return 'abuja';
  return 'park';
}

export type DeliveryLabelFormat = 'badge' | 'arrangementTitle' | 'arrangementLower' | 'detailLabel';

const DELIVERY_LABELS: Record<DeliveryLabelFormat, Record<DeliveryMethod, string>> = {
  badge: {
    pickup: 'Pickup (Abuja Only)',
    abuja: 'Delivery (Abuja)',
    park: 'Park Drop-off',
  },
  arrangementTitle: {
    pickup: 'Pickup Arrangement',
    abuja: 'Delivery Arrangement',
    park: 'Park Drop-off Arrangement',
  },
  arrangementLower: {
    pickup: 'Pickup arrangement',
    abuja: 'Delivery arrangement',
    park: 'Park drop-off arrangement',
  },
  detailLabel: {
    pickup: 'Pickup Location',
    abuja: 'Delivery Address',
    park: 'Park Drop-off Location',
  },
};

/**
 * Resolves the delivery-method label text shared across OrderSummary, PaymentStep,
 * and ConfirmationStep. `format` picks which copy variant is needed — they all branch
 * on the same pickup-in-Abuja / Abuja-delivery / park-drop-off-elsewhere condition,
 * just with different exact wording per surface.
 */
export function getDeliveryLabel(
  deliveryOption: DeliveryOption,
  pickupAvailable: boolean,
  selectedState: string,
  format: DeliveryLabelFormat = 'badge'
): string {
  const method = resolveDeliveryMethod(deliveryOption, pickupAvailable, selectedState);
  return DELIVERY_LABELS[format][method];
}

export type DeliveryDescriptionKind = 'nextSteps' | 'infoPanel';

interface DeliveryDescriptionContext {
  selectedState: string;
  pickupAddress?: string;
  address?: string;
  city?: string;
}

/**
 * Resolves the longer delivery-method prose shared across ConfirmationStep's
 * "What Happens Next" copy and StateDeliveryForm's delivery info panel. Each `kind`
 * preserves its surface's exact original wording.
 */
export function getDeliveryDescription(
  deliveryOption: DeliveryOption,
  pickupAvailable: boolean,
  ctx: DeliveryDescriptionContext,
  kind: DeliveryDescriptionKind = 'nextSteps'
): string {
  const { selectedState, pickupAddress = '', address = '', city = '' } = ctx;
  const method = resolveDeliveryMethod(deliveryOption, pickupAvailable, selectedState);

  if (kind === 'infoPanel') {
    if (method === 'pickup') {
      return `Collect your order from our store in ${selectedState}. We'll contact you when your order is ready for pickup.`;
    }
    if (method === 'abuja') {
      return `Your order will be delivered to your address in ${selectedState}. Please ensure someone is available to receive it.`;
    }
    return `Your order will be delivered to a designated park in ${selectedState}. You'll need to collect it from the park. We'll provide park details after payment verification.`;
  }

  // nextSteps
  if (method === 'pickup') {
    return `You'll be contacted to arrange pickup from ${pickupAddress}`;
  }
  if (method === 'abuja') {
    return `Your items will be delivered to ${address}, ${city}, ${selectedState}`;
  }
  return `Your items will be delivered to the specified park in ${selectedState}. We'll contact you with exact park details.`;
}
