// lib/notifications/index.ts - UPDATED
import { sendOrderEmail } from '@/lib/email';

interface OrderStatusUpdateParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  oldStatus: string;
  newStatus: string;
  customMessage?: string;
}

interface CustomNotificationParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  viaEmail: boolean;
  viaSMS: boolean;
}

export async function sendOrderStatusUpdate(params: OrderStatusUpdateParams) {
  const { orderNumber, customerName, customerEmail, customerPhone, newStatus, customMessage } = params;
  
  const channels: string[] = [];
  
  try {
    // Send email
    if (customerEmail) {
      const statusEmail = await sendStatusEmail({
        orderNumber,
        customerName,
        customerEmail,
        newStatus,
        customMessage
      });
      
      if (statusEmail.success) {
        channels.push('email');
      }
    }
    
    // Send SMS (if you have an SMS service)
    if (customerPhone) {
      const smsResult = await sendStatusSMS({
        customerPhone,
        orderNumber,
        newStatus,
        customMessage
      });
      
      if (smsResult.success) {
        channels.push('sms');
      }
    }
    
    return {
      success: true,
      channels
    };
  } catch (error) {
    console.error('Error sending status update:', error);
    return {
      success: false,
      error: 'Failed to send notifications'
    };
  }
}

export async function sendCustomNotification(params: CustomNotificationParams) {
  const { orderNumber, customerName, customerEmail, customerPhone, message, viaEmail, viaSMS } = params;
  
  const channels: string[] = [];
  
  try {
    // Send email
    if (viaEmail && customerEmail) {
      const emailResult = await sendCustomEmail({
        orderNumber,
        customerName,
        customerEmail,
        message
      });
      
      if (emailResult.success) {
        channels.push('email');
      }
    }
    
    // Send SMS
    if (viaSMS && customerPhone) {
      const smsResult = await sendCustomSMS({
        customerPhone,
        orderNumber,
        message
      });
      
      if (smsResult.success) {
        channels.push('sms');
      }
    }
    
    return {
      success: true,
      channels
    };
  } catch (error) {
    console.error('Error sending custom notification:', error);
    return {
      success: false,
      error: 'Failed to send notifications'
    };
  }
}

// Email functions using your existing sendOrderEmail
async function sendStatusEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  customMessage?: string;
}) {
  const { orderNumber, customerName, customerEmail, newStatus, customMessage } = params;
  
  const statusMessages: Record<string, { subject: string; message: string }> = {
    confirmed: {
      subject: `✅ Order Confirmed - #${orderNumber}`,
      message: `Your order has been confirmed and is being processed.`
    },
    shipped: {
      subject: `🚚 Order Shipped - #${orderNumber}`,
      message: `Your order has been shipped! Track your package for delivery updates.`
    },
    delivered: {
      subject: `📦 Order Delivered - #${orderNumber}`,
      message: `Your order has been delivered. Thank you for shopping with us!`
    },
    cancelled: {
      subject: `❌ Order Cancelled - #${orderNumber}`,
      message: `Your order has been cancelled. Contact us if you have any questions.`
    }
  };
  
  const statusInfo = statusMessages[newStatus] || {
    subject: `Order Status Update - #${orderNumber}`,
    message: `Your order status has been updated to: ${newStatus}`
  };
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${getStatusColor(newStatus)}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .status-badge { display: inline-block; padding: 8px 16px; background: white; color: ${getStatusColor(newStatus)}; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${getStatusColor(newStatus)}; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${getStatusIcon(newStatus)} Order Status Update</h1>
        <p>Hello ${customerName},</p>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <div class="status-badge">
            ${newStatus.toUpperCase()}
          </div>
          <h2>Order #${orderNumber}</h2>
        </div>
        
        <div class="message-box">
          <h3>${statusInfo.subject}</h3>
          <p>${statusInfo.message}</p>
          
          ${customMessage ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <h4>📝 Additional Message:</h4>
              <p>${customMessage}</p>
            </div>
          ` : ''}
        </div>
        
        <p><strong>What's Next?</strong></p>
        <ul>
          ${getNextSteps(newStatus)}
        </ul>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Need Help?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
        </div>
        
        <p>Best regards,<br>
        <strong>The GidiamMini Team</strong></p>
      </div>
      <div class="footer">
        <p>GidiamMini Clothing Store<br>
        Abuja, Nigeria</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    const result = await sendOrderEmail(customerEmail, statusInfo.subject, html);
    return { success: result.success };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

async function sendCustomEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  message: string;
}) {
  const { orderNumber, customerName, customerEmail, message } = params;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .message-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📨 Message About Your Order</h1>
        <p>Hello ${customerName},</p>
      </div>
      <div class="content">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2>Order #${orderNumber}</h2>
          <p>You have a new message from our team:</p>
        </div>
        
        <div class="message-box">
          <p style="font-style: italic; color: #4b5563;">"${message}"</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Need to respond?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
          <p>💬 WhatsApp: +234 809 653 9067</p>
        </div>
        
        <p>Best regards,<br>
        <strong>The GidiamMini Team</strong></p>
      </div>
      <div class="footer">
        <p>GidiamMini Clothing Store<br>
        Abuja, Nigeria</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    const result = await sendOrderEmail(customerEmail, `Message About Your Order #${orderNumber}`, html);
    return { success: result.success };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// SMS functions (placeholder - implement with your SMS provider)
async function sendStatusSMS(params: {
  customerPhone: string;
  orderNumber: string;
  newStatus: string;
  customMessage?: string;
}) {
  const { customerPhone, orderNumber, newStatus, customMessage } = params;
  
  const statusTexts: Record<string, string> = {
    confirmed: `Your order #${orderNumber} has been confirmed! We're processing it now.`,
    shipped: `Great news! Your order #${orderNumber} has been shipped. Track your package for updates.`,
    delivered: `Your order #${orderNumber} has been delivered! Thank you for shopping with GidiamMini.`,
    cancelled: `Your order #${orderNumber} has been cancelled. Contact us at 0809 653 9067 if you have questions.`
  };
  
  const baseMessage = statusTexts[newStatus] || `Your order #${orderNumber} status: ${newStatus}`;
  const fullMessage = customMessage ? `${baseMessage}\n\n${customMessage}` : baseMessage;
  
  // TODO: Implement actual SMS sending with your SMS provider
  // Example with Termii (popular in Nigeria):
  // const termiiApiKey = process.env.TERMII_API_KEY;
  // const termiiSenderId = process.env.TERMII_SENDER_ID;
  
  // try {
  //   const response = await fetch('https://api.ng.termii.com/api/sms/send', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       to: customerPhone,
  //       from: termiiSenderId,
  //       sms: fullMessage,
  //       type: 'plain',
  //       channel: 'generic',
  //       api_key: termiiApiKey,
  //     }),
  //   });
  
  //   const data = await response.json();
  //   return { success: data.code === 'ok' };
  // } catch (error) {
  //   console.error('SMS error:', error);
  //   return { success: false, error: 'Failed to send SMS' };
  // }
  
  // For now, just log and return success (simulation)
  console.log(`📱 SMS to ${customerPhone}: ${fullMessage}`);
  console.log('ℹ️ To enable real SMS, add Termii/Twilio credentials to .env.local');
  return { success: true };
}

async function sendCustomSMS(params: {
  customerPhone: string;
  orderNumber: string;
  message: string;
}) {
  const { customerPhone, orderNumber, message } = params;
  
  const fullMessage = `GidiamMini Order #${orderNumber}: ${message}`;
  
  // TODO: Implement actual SMS sending
  console.log(`📱 SMS to ${customerPhone}: ${fullMessage}`);
  console.log('ℹ️ To enable real SMS, add Termii/Twilio credentials to .env.local');
  return { success: true };
}

// Helper functions
function getStatusColor(status: string): string {
  switch(status) {
    case 'confirmed': return '#3b82f6'; // blue
    case 'shipped': return '#8b5cf6'; // purple
    case 'delivered': return '#10b981'; // green
    case 'cancelled': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

function getStatusIcon(status: string): string {
  switch(status) {
    case 'confirmed': return '✅';
    case 'shipped': return '🚚';
    case 'delivered': return '📦';
    case 'cancelled': return '❌';
    default: return '📋';
  }
}

function getNextSteps(status: string): string {
  switch(status) {
    case 'confirmed':
      return `
        <li>We'll prepare your items for shipping</li>
        <li>You'll receive another update when your order ships</li>
        <li>Estimated delivery: 3-5 business days</li>
      `;
    case 'shipped':
      return `
        <li>Track your package using the tracking link provided</li>
        <li>Be available to receive your delivery</li>
        <li>Contact us if there are any delivery issues</li>
      `;
    case 'delivered':
      return `
        <li>Check your items upon delivery</li>
        <li>Contact us within 24 hours if there are any issues</li>
        <li>Share your experience with a review</li>
      `;
    case 'cancelled':
      return `
        <li>Contact us if you have questions about the cancellation</li>
        <li>Refunds (if applicable) will be processed within 5-7 business days</li>
        <li>Browse our store for other items you might like</li>
      `;
    default:
      return `
        <li>We'll keep you updated on your order progress</li>
        <li>Contact us if you have any questions</li>
      `;
  }
}