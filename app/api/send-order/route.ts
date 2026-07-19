// app/api/send-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  formatOrderItemsList,
  buildOwnerOrderEmailText,
  buildOwnerOrderEmailHtml,
  buildCustomerOrderEmailText,
  buildCustomerOrderEmailHtml
} from '@/lib/notifications/templates/order-emails';

// NOTE: this route intentionally builds its own nodemailer transporter rather
// than using lib/email.ts's sendOrderEmail. lib/email.ts's transporter uses
// EMAIL_HOST/EMAIL_PORT/EMAIL_SECURE (defaulting to smtp.gmail.com:587,
// secure=false) while this route uses nodemailer's `service: 'gmail'` shortcut
// (which resolves to smtp.gmail.com:465, secure=true). These are not
// guaranteed equivalent, so the transporter here is preserved as-is; only the
// HTML/text templates were extracted for reuse/readability.
export async function POST(request: NextRequest) {
  console.log('📦 Order API called at:', new Date().toISOString());

  try {
    const body = await request.json();
    console.log('Received order data:', {
      orderNumber: body.orderNumber,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      itemCount: body.items?.length || 0
    });

    // Check for required environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ EMAIL_USER or EMAIL_PASS environment variables are missing! Email notifications cannot be sent.');

      return NextResponse.json(
        {
          success: false,
          error: 'Email service configuration error',
          details: 'Email credentials not configured on the server. Please configure EMAIL_USER and EMAIL_PASS in .env.local'
        },
        { status: 500 }
      );
    }

    // Try to send emails
    try {
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const itemsList = formatOrderItemsList(body.items);

      // Email to store owner
      const ownerMailOptions = {
        from: `"GidiamMini Store" <${process.env.EMAIL_USER}>`,
        to: process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com',
        subject: `🛍️ NEW ORDER #${body.orderNumber} - ${body.customerName}`,
        text: buildOwnerOrderEmailText(body, itemsList),
        html: buildOwnerOrderEmailHtml(body, itemsList),
      };

      // Send email to store owner
      await transporter.sendMail(ownerMailOptions);
      console.log('✅ Email sent to store owner');

      // Send confirmation to customer if email is provided
      if (body.customerEmail) {
        const customerMailOptions = {
          from: `"GidiamMini Store" <${process.env.EMAIL_USER}>`,
          to: body.customerEmail,
          subject: `✅ Order Confirmation #${body.orderNumber}`,
          text: buildCustomerOrderEmailText(body),
          html: buildCustomerOrderEmailHtml(body),
        };

        await transporter.sendMail(customerMailOptions);
        console.log('✅ Confirmation email sent to customer');
      }

      return NextResponse.json({
        success: true,
        message: 'Order submitted successfully! Emails sent.',
        orderNumber: body.orderNumber,
        emailsSent: true,
        timestamp: new Date().toISOString()
      });

    } catch (emailError: any) {
      console.error('Email error:', emailError);

      // Still return success but note email failed
      return NextResponse.json({
        success: true,
        message: 'Order received but email failed to send',
        orderNumber: body.orderNumber,
        emailsSent: false,
        error: emailError.message,
        note: 'Please contact store directly at 0809 653 9067',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ API error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process order',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Add GET for testing
export async function GET() {
  return NextResponse.json({
    message: 'Send Order API',
    status: 'active',
    endpoint: 'POST /api/send-order to submit an order',
    requiredFields: ['orderNumber', 'customerName', 'customerEmail', 'total'],
    timestamp: new Date().toISOString()
  });
}
