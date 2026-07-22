/** COMMERCE layer — verifies a customer-supplied order number + email/phone
 * combination matches an order. Shared by every public order endpoint (order
 * tracking, change requests) so an order number alone — guessable, it's just
 * "UT" + a timestamp — can never expose someone else's order. */

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function verifyOrderContact(
  order: { customer_email?: string | null; customer_phone?: string | null },
  contact: string
): boolean {
  const contactInput = contact.trim().toLowerCase();
  const emailMatches = order.customer_email?.toLowerCase() === contactInput;
  const phoneMatches = !!order.customer_phone && normalizePhone(order.customer_phone).toLowerCase() === normalizePhone(contactInput);

  return emailMatches || phoneMatches;
}
