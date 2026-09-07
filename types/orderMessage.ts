// types/orderMessage.ts — one message in the conversation on an order.
// See supabase/migrations/20260907130100_order_messages.sql.

export type OrderMessageSender = 'customer' | 'admin';

export interface OrderMessage {
  id: string;
  order_id: string;
  sender: OrderMessageSender;
  body: string;
  created_at: string;
}
