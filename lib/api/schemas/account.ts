/**
 * Request schemas for the passwordless customer account.
 *
 * The sign-in field takes an email or a phone number in one box, because
 * asking a customer which one they used at checkout is asking them to remember
 * something about our database. parseContact works out which it is.
 */
import { z } from 'zod';
import { MAX_LENGTHS, contactField, honeypotFields } from './common';

export const signInRequestSchema = z.object({
  ...honeypotFields,
  /** An email or a phone number. Length-capped by the shared field; which one
   *  it is gets decided by parseContact, not by the schema. */
  contact: contactField,
});

export type SignInRequestBody = z.infer<typeof signInRequestSchema>;

/**
 * Redeeming the emailed link.
 *
 * A POST with the token in the body, not a GET with it in the query string.
 * The link in the inbox is a GET — but it lands on a page that asks the
 * customer to press a button, because inboxes and security scanners prefetch
 * links and a single-use token would be spent before the customer touched it.
 */
export const signInVerifySchema = z.object({
  token: z
    .string({ error: 'That sign-in link is not valid.' })
    .trim()
    .regex(/^[A-Za-z0-9_-]{40,64}$/, 'That sign-in link is not valid.'),
});

export type SignInVerifyBody = z.infer<typeof signInVerifySchema>;

export const reorderSchema = z.object({
  orderId: z.string().uuid('That order could not be identified.'),
});

export type ReorderBody = z.infer<typeof reorderSchema>;

// Referenced so the cap the sign-in box enforces is the shared one.
export const MAX_CONTACT_LENGTH = MAX_LENGTHS.email;
