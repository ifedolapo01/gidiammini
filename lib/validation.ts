/**
 * CORE layer — shared format primitives.
 *
 * These live in one place because the same question ("is this a usable email
 * address?") is asked by the checkout, the contact form, the newsletter and the
 * API schemas. Three separate copies of the pattern meant three chances for
 * them to drift, so a customer could be accepted at checkout and rejected by
 * the newsletter with the same address.
 *
 * Pure and dependency-free, so both the COMMERCE and API layers can import it.
 */

/**
 * Deliberately permissive: one @, no whitespace, a dot in the domain. Anything
 * stricter starts rejecting addresses that genuinely deliver, and the only way
 * to truly know is to send. Length is capped by the callers.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
