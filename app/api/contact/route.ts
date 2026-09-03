// app/api/contact/route.ts - public "Contact Us" form submissions. No auth;
// forwards straight to the store owner's inbox, same trust model as
// /api/orders/change-requests.
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { contactFormSchema } from '@/lib/api/schemas/public-forms';
import { isBotSubmission } from '@/lib/api/schemas/common';

async function submitContactForm(request: NextRequest) {
  try {
    // Every field arrives trimmed, length-capped and the right type, so a
    // malformed submission is a 400 naming the input rather than a 500 from
    // calling .trim() on a number.
    const parsed = await parseJsonBody(request, contactFormSchema);
    if (!parsed.ok) return parsed.response;

    const { name, email, phone, message } = parsed.data;

    // Answered with success rather than an error, so a scripted submitter gets
    // no signal that it was detected.
    if (isBotSubmission(parsed.data)) {
      console.warn('Contact form honeypot triggered — discarding silently.');
      return NextResponse.json({ success: true });
    }

    const ownerEmail = process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com';

    const result = await sendOrderEmail(
      ownerEmail,
      sanitizeHeader(`New contact form message from ${name}`),
      // Every value here is typed by an anonymous visitor and read by the store
      // owner, so all of it is escaped before it reaches the mail body.
      `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>` +
        (phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : '') +
        `<p><strong>Message:</strong></p><p>${escapeHtmlWithBreaks(message)}</p>`
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to send your message. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.contact,
  submitContactForm,
  "You've sent several messages already. Please wait a while before sending another."
);
