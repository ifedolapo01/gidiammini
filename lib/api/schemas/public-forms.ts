/**
 * Request schemas for the two public forms that aren't part of checkout:
 * "Contact us" and the newsletter signup.
 *
 * Both were previously guarded by truthiness checks only, so `{"name": 123}`
 * passed the guard and then threw on `.trim()` — a 500 for what is plainly a
 * bad request. The newsletter accepted any string as an email and wrote it
 * straight to the `subscribers` table, so junk addresses accumulated there and
 * every future campaign tried to mail them.
 */
import { z } from 'zod';
import {
  MAX_LENGTHS,
  emailField,
  nameField,
  optionalText,
  requiredText,
  honeypotFields,
} from './common';

export const contactFormSchema = z.object({
  ...honeypotFields,
  name: nameField,
  email: emailField,
  phone: optionalText('Phone number', MAX_LENGTHS.phone),
  message: requiredText('A message', MAX_LENGTHS.message),
});

export type ContactFormBody = z.infer<typeof contactFormSchema>;

/**
 * Newsletter signup.
 *
 * The name is optional because the footer form — the one on every page of the
 * site — asks for an email and nothing else; a second box there costs more
 * subscribers than the greeting in the welcome email is worth. The checkout
 * opt-in still sends one, because it already has it.
 */
export const subscribeSchema = z.object({
  ...honeypotFields,
  name: optionalText('Name', MAX_LENGTHS.name),
  email: emailField,
});

export type SubscribeBody = z.infer<typeof subscribeSchema>;

/**
 * "Email me when it's back", from the out-of-stock notice.
 *
 * No name field: the person is telling us one thing about one product, and
 * every extra box on that form is a reason not to fill it in. Honeypot included
 * for the same reason the newsletter form has one — an unauthenticated form
 * that writes an email address to a table is a form that gets scripted.
 */
export const stockAlertSchema = z.object({
  ...honeypotFields,
  email: emailField,
  productId: z.string().uuid('That product could not be identified.'),
  /** The variant they were looking at, when there was one. */
  variantKey: z.string().max(200).optional().nullable(),
});

export type StockAlertBody = z.infer<typeof stockAlertSchema>;
