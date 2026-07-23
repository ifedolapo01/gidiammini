// app/api/contact/route.ts - public "Contact Us" form submissions. No auth;
// forwards straight to the store owner's inbox, same trust model as
// /api/orders/change-requests.
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderEmail } from '@/lib/email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, message } = await request.json();

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
      `New contact form message from ${name.trim()}`,
      `<p><strong>From:</strong> ${name.trim()} (${email.trim()})</p>` +
        (phone?.trim() ? `<p><strong>Phone:</strong> ${phone.trim()}</p>` : '') +
        `<p><strong>Message:</strong></p><p>${message.trim().replace(/\n/g, '<br>')}</p>`
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
