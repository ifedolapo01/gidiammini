/**
 * Request schema for the admin customer editor.
 *
 * Only the three operational fields are writable. Identity — email, phone —
 * is maintained from checkout by lib/commerce/customer-identity.ts; letting an
 * admin edit it here would silently detach the record from the orders that
 * resolve to it by email.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText } from './common';

export const customerUpdateSchema = z.object({
  is_blocked: z.boolean({ error: 'Blocked must be true or false.' }),
  blocked_reason: optionalText('Reason', MAX_LENGTHS.note),
  notes: optionalText('Notes', MAX_LENGTHS.message),
});

export type CustomerUpdateBody = z.infer<typeof customerUpdateSchema>;
