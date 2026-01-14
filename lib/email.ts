// lib/email.ts - ENHANCED
import nodemailer from 'nodemailer';

// Create a reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export async function sendOrderEmail(to: string, subject: string, html: string) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"UrbanThreads Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// New function to send admin notifications
export async function sendAdminNotification(subject: string, html: string) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) {
      console.warn('⚠️ No admin email configured');
      return { success: false, error: 'No admin email configured' };
    }

    return await sendOrderEmail(adminEmail, subject, html);
  } catch (error) {
    console.error('Admin email error:', error);
    return { success: false, error: 'Failed to send admin email' };
  }
}

// Function to send email to multiple recipients
export async function sendBulkEmail(recipients: string[], subject: string, html: string) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"UrbanThreads Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      bcc: recipients.join(','), // Use BCC for privacy
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Bulk email sent to ${recipients.length} recipients: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Bulk email error:', error);
    return { success: false, error: 'Failed to send bulk email' };
  }
}

// Test email connection
export async function testEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email server connection verified');
    return { success: true, message: 'Email server connection verified' };
  } catch (error) {
    console.error('❌ Email connection test failed:', error);
    return { success: false, error: 'Email connection test failed' };
  }
}