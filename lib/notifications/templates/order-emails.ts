// lib/notifications/templates/order-emails.ts
// Templates for the two notification emails sent by app/api/send-order/route.ts
// (store owner alert + customer confirmation). Kept separate from
// lib/notifications' status-update templates: this route builds its own
// nodemailer transporter (gmail service via EMAIL_USER/EMAIL_PASS) rather than
// going through lib/email.ts's configurable host/port transporter, since the
// two setups are not guaranteed equivalent (see route file for details).
import { buildTrackOrderButton } from './track-order-cta';

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryOption: string;
  selectedState: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  items?: OrderEmailItem[];
  total?: number;
  note?: string;
}

export function formatOrderItemsList(items?: OrderEmailItem[]): string {
  return items?.map((item) =>
    `• ${item.name} x${item.quantity} - ₦${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`
  ).join('\n') || 'No items';
}

export function buildOwnerOrderEmailText(body: OrderEmailData, itemsList: string): string {
  return `
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
        `;
}

export function buildOwnerOrderEmailHtml(body: OrderEmailData, itemsList: string): string {
  return `
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
        `;
}

export function buildCustomerOrderEmailText(body: OrderEmailData): string {
  return `Thank you for your order ${body.customerName}!

Order #: ${body.orderNumber}
Amount: ₦${body.total?.toLocaleString() || '0'}
Delivery: ${body.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'} to ${body.selectedState}

We've received your payment and will contact you within 24 hours.

For inquiries: 0809 653 9067`;
}

export function buildCustomerOrderEmailHtml(body: OrderEmailData): string {
  return `
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

              ${buildTrackOrderButton('#2563eb')}

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280;">For any questions:</p>
                <p style="font-size: 18px; color: #3b82f6; font-weight: bold;">📞 0809 653 9067</p>
              </div>
            </div>
          `;
}
