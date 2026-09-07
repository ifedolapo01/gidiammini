// types/orderChangeRequest.ts

export type OrderChangeRequestType =
  | 'reschedule'
  | 'delivery_method_change'
  | 'cancel'
  | 'address_correction'
  | 'item_swap'
  | 'add_item'
  | 'return_request'
  | 'hold_until';

export type OrderChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RescheduleDetails {
  preferredDate: string;
}

export interface DeliveryMethodChangeDetails {
  newDeliveryOption: 'pickup' | 'delivery';
  deliveryAddress?: string;
  city?: string;
}

/** No fields needed — the customer's reason (if any) goes in customer_note. */
export type CancelDetails = Record<string, never>;

export interface AddressCorrectionDetails {
  newAddress: string;
  city?: string;
}

/** The new size/colour is free text, like reschedule's preferredDate — it is
 *  resolved against real stock when the request is approved, not at submission. */
export interface ItemSwapDetails {
  /** Must be a product already on this order. */
  productId: string;
  newSize?: string;
  newColor?: string;
}

/** Another line of a product already on the order — not a pick from the whole
 *  catalogue. Size/colour are free text, resolved on approval like ItemSwapDetails. */
export interface AddItemDetails {
  productId: string;
  size?: string;
  color?: string;
  quantity: number;
}

export interface ReturnRequestDetails {
  orderItemIds: string[];
  reason: string;
}

export interface HoldUntilDetails {
  holdUntilDate: string;
}

export interface OrderChangeRequest {
  id: string;
  order_id: string;
  request_type: OrderChangeRequestType;
  status: OrderChangeRequestStatus;
  details:
    | RescheduleDetails
    | DeliveryMethodChangeDetails
    | CancelDetails
    | AddressCorrectionDetails
    | ItemSwapDetails
    | AddItemDetails
    | ReturnRequestDetails
    | HoldUntilDetails;
  customer_note: string | null;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}
