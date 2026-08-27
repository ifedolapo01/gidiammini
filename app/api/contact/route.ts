// app/api/contact/route.ts - public "Contact Us" form submissions. No auth;
// forwards straight to the store owner's inbox, same trust model as
// /api/orders/change-requests.
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hidden form field. A human never sees it, so anything in it came from a bot
 * filling every input on the page. Answered with a success response rather than
 * an error, so a scripted submitter gets no signal that it was detected. */
function isBotSubmission(body: Record<string, unknown>): boolean {
  const trap = body.website ?? body.company_url;
  return typeof trap === 'string' && trap.trim().length > 0;
}


async function submitContactForm(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    if (isBotSubmission(body)) {
      console.warn('Contact form honeypot triggered — discarding silently.');
      return NextResponse.json({ success: true });
    }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const ownerEmail = process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com';

    const result = await sendOrderEmail(
      ownerEmail,
      sanitizeHeader(`New contact form message from ${name.trim()}`),
      // Every value here is typed by an anonymous visitor and read by the store
      // owner, so all of it is escaped before it reaches the mail body.
      `<p><strong>From:</strong> ${escapeHtml(name.trim())} (${escapeHtml(email.trim())})</p>` +
        (phone?.trim() ? `<p><strong>Phone:</strong> ${escapeHtml(phone.trim())}</p>` : '') +
        `<p><strong>Message:</strong></p><p>${escapeHtmlWithBreaks(message.trim())}</p>`
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
