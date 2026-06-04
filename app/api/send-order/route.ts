// app/api/send-order/route.ts
import { NextRequest, NextResponse } from 'next/server';

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

      // Format items list
      const itemsList = body.items?.map((item: any) => 
        `• ${item.name} x${item.quantity} - ₦${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`
      ).join('\n') || 'No items';

      // Email to store owner
      const ownerMailOptions = {
        from: `"GidiamMini Store" <${process.env.EMAIL_USER}>`,
        to: process.env.STORE_OWNER_EMAIL || 'ifedolapoajayi0@gmail.com',
        subject: `🛍️ NEW ORDER #${body.orderNumber} - ${body.customerName}`,
        text: `
NEW ORDER #${body.orderNumber}
Time: ${new Date().toLocaleString('en-NG')}

CUSTOMER DETAILS
Name: ${body.customerName}
Email: ${body.customerEmail}
Phone: ${body.customerPhone}

DELIVERY DETAILS
Method: ${body.deliveryOption === 'pickup' ? 'PICKUP' : 'DELIVERY'}
State: ${body.selectedState}
${body.deliveryOption === 'pickup' 
  ? `Pickup Address: ${body.pickupAddress}`
  : `Delivery Address: ${body.deliveryAddress}`
}

ORDER ITEMS
${itemsList}

PAYMENT DETAILS
Total Amount: ₦${body.total?.toLocaleString() || '0'}
Status: ✅ Payment Receipt Uploaded

${body.note ? `CUSTOMER NOTE:\n${body.note}\n` : ''}
Order received at: ${new Date().toISOString()}
        `,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h1 style="color: #2563eb;">📦 NEW ORDER #${body.orderNumber}</h1>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-NG')}</p>
            
            <h2 style="color: #4b5563;">👤 Customer Details</h2>
            <p><strong>Name:</strong> ${body.customerName}</p>
            <p><strong>Email:</strong> ${body.customerEmail}</p>
            <p><strong>Phone:</strong> ${body.customerPhone}</p>
            
            <h2 style="color: #4b5563;">🚚 Delivery Details</h2>
            <p><strong>Method:</strong> ${body.deliveryOption === 'pickup' ? 'PICKUP' : 'DELIVERY'}</p>
            <p><strong>State:</strong> ${body.selectedState}</p>
            ${body.deliveryOption === 'pickup' 
              ? `<p><strong>Pickup Address:</strong> ${body.pickupAddress}</p>`
              : `<p><strong>Delivery Address:</strong> ${body.deliveryAddress}</p>`
            }
            
            <h2 style="color: #4b5563;">🛒 Order Items</h2>
            <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px;">${itemsList}</pre>
            
            <h2 style="color: #4b5563;">💰 Payment Details</h2>
            <p><strong>Total Amount:</strong> ₦${body.total?.toLocaleString() || '0'}</p>
            <p><strong>Status:</strong> ✅ Payment Receipt Uploaded</p>
            
            ${body.note ? `<h2 style="color: #4b5563;">📝 Customer Note</h2><p>${body.note}</p>` : ''}
            
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
              Order received at: ${new Date().toISOString()}
            </p>
          </div>
        `,
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
          text: `Thank you for your order ${body.customerName}!

Order #: ${body.orderNumber}
Amount: ₦${body.total?.toLocaleString() || '0'}
Delivery: ${body.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'} to ${body.selectedState}

We've received your payment and will contact you within 24 hours.

For inquiries: 0809 653 9067`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; text-align: center;">
              <h1 style="color: #10b981;">✅ Order Confirmed!</h1>
              <p>Thank you for your order, ${body.customerName}!</p>
              
              <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2563eb;">Order Details</h3>
                <p><strong>Order #:</strong> ${body.orderNumber}</p>
                <p><strong>Amount:</strong> ₦${body.total?.toLocaleString() || '0'}</p>
                <p><strong>Delivery:</strong> ${body.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'} to ${body.selectedState}</p>
              </div>
              
              <p>We've received your payment receipt and will verify it within 24 hours.</p>
              <p>You'll be contacted via phone/email for next steps.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280;">For any questions:</p>
                <p style="font-size: 18px; color: #3b82f6; font-weight: bold;">📞 0809 653 9067</p>
              </div>
            </div>
          `,
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