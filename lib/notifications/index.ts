// lib/notifications/index.ts - orchestration only
import { sendOrderEmail } from '@/lib/email';
import { buildStatusEmail } from './templates/status-email';
import { buildCustomEmail } from './templates/custom-email';
import { sendStatusSMS, sendCustomSMS } from './sms';

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
      const statusEmail = await sendStatusEmailNotification({
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
      const emailResult = await sendCustomEmailNotification({
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

// Email senders - build the template, then send via lib/email.ts's shared transporter
async function sendStatusEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  customMessage?: string;
}) {
  const { customerEmail, ...templateParams } = params;

  try {
    const { subject, html } = buildStatusEmail(templateParams);
    const result = await sendOrderEmail(customerEmail, subject, html);
    return { success: result.success };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

async function sendCustomEmailNotification(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  message: string;
}) {
  const { customerEmail, ...templateParams } = params;

  try {
    const { subject, html } = buildCustomEmail(templateParams);
    const result = await sendOrderEmail(customerEmail, subject, html);
    return { success: result.success };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}
