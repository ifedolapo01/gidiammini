/**
 * Escaping for values interpolated into HTML email bodies.
 *
 * Every customer-facing template builds its HTML with template literals, and
 * several of the values interpolated into them are typed by the public with no
 * authentication at all:
 *
 *   - `customer_name` comes straight from the checkout form
 *   - the contact form's name / email / phone / message are wholly anonymous
 *   - `customer_note` on an order change request is customer-authored
 *
 * Two of those land in emails the store owner reads. Unescaped, a sender can
 * inject arbitrary markup — styled blocks, links, a fake "click here to verify"
 * — into a message that appears to come from the store's own system. Email
 * clients don't run script, so this isn't XSS; it's content spoofing aimed at
 * whoever opens the mail, and it's worse in a mailbox than in a browser because
 * the reader already trusts the sender.
 *
 * Escaping happens at the point of interpolation rather than on input, so the
 * stored value stays exactly what the customer typed (an admin viewing an order
 * should see `O'Brien`, not `O&#39;Brien`).
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes the five characters that matter in HTML text and attribute contexts.
 * Non-string input is coerced first, so an unexpected null or number can't
 * throw inside a template.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Escapes, then turns newlines into `<br>`.
 *
 * Order matters: converting to `<br>` first and escaping afterwards would
 * escape the tag itself and print a literal "&lt;br&gt;" to the reader.
 * Carriage returns are folded so CRLF input doesn't double up the breaks.
 */
export function escapeHtmlWithBreaks(value: unknown): string {
  return escapeHtml(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

/**
 * Strips CR/LF from a value destined for an email *header* (a subject line).
 *
 * Nodemailer encodes headers, but a newline in a subject is the classic header
 * injection primitive, and stripping is free. Also collapses runs of
 * whitespace, since a subject spanning multiple lines is broken anyway.
 */
export function sanitizeHeader(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
