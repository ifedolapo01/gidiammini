/**
 * Request schema for POST /api/orders/returns.
 *
 * Split out of order-change-request.ts's discriminated union now that a
 * return is no longer one of its eight request types — its own table
 * (returns) needs a quantity per line, which order_change_requests' flat
 * `orderItemIds: uuid[]` never carried.
 */
import { z } from 'zod';
import { MAX_LENGTHS, contactField, orderNumberField, requiredText } from './common';
import { MAX_LINE_QUANTITY, MAX_CART_LINES } from '../../commerce/cart-input';

const returnItemSchema = z.object({
  orderItemId: requiredText('An item', 100),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const createReturnSchema = z.object({
  orderNumber: orderNumberField,
  contact: contactField,
  reason: requiredText('A reason', MAX_LENGTHS.note),
  items: z.array(returnItemSchema).min(1, 'Choose at least one item to return.').max(MAX_CART_LINES),
});

export type CreateReturnBody = z.infer<typeof createReturnSchema>;
