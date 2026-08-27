/**
 * Escaping for HTML email bodies, and proof that the templates which read
 * customer-supplied values actually apply it.
 *
 * The threat is not XSS — mail clients don't run script. It's content spoofing:
 * an anonymous sender injecting styled markup and links into a message the
 * store owner receives from the store's own system, which they already trust.
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from './escape-html';
import { buildCustomEmail } from './templates/custom-email';
import { buildOrderReceivedEmail } from './templates/order-received-email';
import { buildPaymentReminderEmail } from './templates/payment-reminder-email';

describe('escapeHtml', () => {
  it('escapes all five significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the ampersand first, so entities are not double-encoded oddly', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('neutralises a tag', () => {
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('neutralises an attribute break-out', () => {
    expect(escapeHtml('" onload="evil()')).toBe('&quot; onload=&quot;evil()');
  });

  it('leaves ordinary text, punctuation and non-ASCII alone', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
    expect(escapeHtml('Adébáyọ̀ — Ikeja')).toBe('Adébáyọ̀ — Ikeja');
    expect(escapeHtml('₦16,500')).toBe('₦16,500');
  });

  it('returns an empty string for null and undefined instead of printing them', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-strings rather than throwing', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(false)).toBe('false');
  });
});

describe('escapeHtmlWithBreaks', () => {
  it('escapes before converting newlines, so the <br> survives', () => {
    expect(escapeHtmlWithBreaks('a\nb')).toBe('a<br>b');
  });

  it('does not let injected markup through on a multiline value', () => {
    const result = escapeHtmlWithBreaks('line one\n<script>alert(1)</script>');
    expect(result).toBe('line one<br>&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('treats CRLF as a single break', () => {
    expect(escapeHtmlWithBreaks('a\r\nb')).toBe('a<br>b');
    expect(escapeHtmlWithBreaks('a\rb')).toBe('a<br>b');
  });

  it('handles a value with no newlines', () => {
    expect(escapeHtmlWithBreaks('plain')).toBe('plain');
  });
});

describe('sanitizeHeader', () => {
  it('strips the newlines used for header injection', () => {
    expect(sanitizeHeader('Subject\nBcc: victim@example.com')).toBe('Subject Bcc: victim@example.com');
    expect(sanitizeHeader('Subject\r\nBcc: victim@example.com')).toBe('Subject Bcc: victim@example.com');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(sanitizeHeader('  too    many   spaces  ')).toBe('too many spaces');
  });

  it('leaves a normal subject untouched', () => {
    expect(sanitizeHeader('Order received — #UT12345678')).toBe('Order received — #UT12345678');
  });
});

describe('the templates apply it', () => {
  // A customer can type anything into the checkout name field; it is not
  // authenticated and it reaches several emails.
  const HOSTILE_NAME = '<a href="https://evil.example">Click to verify</a>';
  const HOSTILE_MESSAGE = '</p><h1 style="color:red">URGENT: send money</h1><p>';

  it('escapes customerName in the order-received email', () => {
    const { html } = buildOrderReceivedEmail({ orderNumber: 'UT1', customerName: HOSTILE_NAME });
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('escapes customerName in the payment-reminder email', () => {
    const { html } = buildPaymentReminderEmail({ orderNumber: 'UT1', customerName: HOSTILE_NAME, totalAmount: 1000 });
    expect(html).not.toContain('<a href="https://evil.example">');
  });

  it('escapes both customerName and the message body in a custom notification', () => {
    const { html } = buildCustomEmail({ orderNumber: 'UT1', customerName: HOSTILE_NAME, message: HOSTILE_MESSAGE });
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).not.toContain('<h1 style="color:red">');
    expect(html).toContain('URGENT: send money'); // the text still shows, inert
  });

  it('strips newlines out of subjects built from an order number', () => {
    const { subject } = buildCustomEmail({
      orderNumber: 'UT1\nBcc: victim@example.com',
      customerName: 'Ada',
      message: 'hi',
    });
    expect(subject).not.toContain('\n');
  });

  it('still renders the real content correctly for ordinary input', () => {
    const { subject, html } = buildOrderReceivedEmail({ orderNumber: 'UT24445514', customerName: "Ada O'Brien" });
    expect(subject).toBe('Order received — #UT24445514');
    expect(html).toContain('#UT24445514');
    expect(html).toContain('Ada O&#39;Brien');
  });
});
