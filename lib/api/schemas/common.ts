/**
 * CORE layer — the field primitives every public request schema is built from.
 *
 * Centralised so "what counts as a valid email" has one answer across
 * checkout, the contact form and the newsletter, and so every free-text field
 * carries a length cap. The caps are generous enough that no real customer
 * meets them; they exist so an unbounded string can't be pushed into a text
 * column, an email body, or a log line.
 */
import { z } from 'zod';
import { isValidEmail } from '@/lib/validation';

/** Longest values accepted per field. Named so the messages stay in sync. */
export const MAX_LENGTHS = {
  name: 120,
  /** The RFC 5321 maximum for a full address. */
  email: 254,
  phone: 32,
  orderNumber: 32,
  address: 500,
  city: 120,
  note: 1000,
  message: 5000,
  /** Free text the customer picks for a preferred delivery date. */
  date: 64,
} as const;

/** A trimmed, non-empty, length-capped string. `.trim()` runs before the length
 * checks, so "   " fails as empty rather than passing as three characters. */
export function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/** Same, but an absent, null or blank value becomes `''` instead of an error. */
export function optionalText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullish()
    .transform((value) => value ?? '');
}

export const emailField = requiredText('Email', MAX_LENGTHS.email)
  .toLowerCase()
  // Uses the shared pattern rather than zod's stricter built-in check, so an
  // address accepted at checkout is never rejected by the newsletter.
  .refine(isValidEmail, 'Please enter a valid email address.');

export const nameField = requiredText('Name', MAX_LENGTHS.name);

export const phoneField = requiredText('Phone number', MAX_LENGTHS.phone);

/** Customers paste the number as it appears on their confirmation ("#UT12345678"),
 * so a leading '#' is stripped rather than rejected. */
export const orderNumberField = requiredText('Order number', MAX_LENGTHS.orderNumber)
  .transform((value) => value.replace(/^#/, ''));

/** The email or phone used at checkout — the second half of the credential a
 * public order lookup needs, so an order number alone reveals nothing. */
export const contactField = requiredText('Email or phone number', MAX_LENGTHS.email);

/**
 * The hidden honeypot inputs on the contact and newsletter forms. Declared here
 * so the schema accepts them: without this the strip would silently drop them
 * and the route could never see that a bot had filled one in.
 */
export const honeypotFields = {
  website: z.string().nullish(),
  company_url: z.string().nullish(),
};

/** True when a honeypot was filled. A human never sees these inputs. */
export function isBotSubmission(body: { website?: string | null; company_url?: string | null }): boolean {
  return Boolean(body.website?.trim() || body.company_url?.trim());
}

