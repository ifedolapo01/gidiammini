// lib/notifications/sms.ts
// SMS sending stubs (simulation only - just logs and returns success).
// Real Termii integration is commented out below pending credentials; the
// stub AND the commented-out code are preserved exactly as they were.

export async function sendStatusSMS(params: {
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

export async function sendCustomSMS(params: {
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
