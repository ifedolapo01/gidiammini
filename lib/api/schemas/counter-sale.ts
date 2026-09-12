/**
 * Request schema for ringing up a counter sale.
 *
 * `items` is left as `unknown`, same as public-orders.ts: cart-input.ts is
 * already the trust boundary for cart lines, and restating its rules in zod
 * would create a second definition that could drift from the one pricing
 * actually uses. Every identity field is optional — a walk-in customer paying
 * cash may give none of them, unlike the online checkout this otherwise
 * mirrors.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText } from './common';

export const counterSaleSchema = z.object({
  items: z.unknown().optional(),
  customer_name: optionalText('Name', MAX_LENGTHS.name),
  customer_email: optionalText('Email', MAX_LENGTHS.email),
  customer_phone: optionalText('Phone', MAX_LENGTHS.phone),
  payment_method: z.enum(['cash', 'pos'], { error: 'Choose how this sale was paid for.' }),
  idempotency_key: z.string({ error: 'This sale is missing its reference.' }),
});

export type CounterSaleBody = z.infer<typeof counterSaleSchema>;
