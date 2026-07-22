// types/orderChangeRequest.ts

export type OrderChangeRequestType = 'reschedule' | 'delivery_method_change';
export type OrderChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RescheduleDetails {
  preferredDate: string;
}

export interface DeliveryMethodChangeDetails {
  newDeliveryOption: 'pickup' | 'delivery';
  deliveryAddress?: string;
  city?: string;
}

export interface OrderChangeRequest {
  id: string;
  order_id: string;
  request_type: OrderChangeRequestType;
  status: OrderChangeRequestStatus;
  details: RescheduleDetails | DeliveryMethodChangeDetails;
  customer_note: string | null;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}
