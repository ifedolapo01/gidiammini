import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const maxDuration = 300;

async function notifySubscribers(supabase: SupabaseClient, req: NextRequest) {
  const body = await req.json();
  const { discountId, customSubject, customMessage } = body;

  if (!discountId || !customSubject || !customMessage) {
    return NextResponse.json(
      { success: false, error: 'discountId, customSubject and customMessage are required' },
      { status: 400 }
    );
  }

  // Fetch Discount
  const { data: discount, error: discountError } = await supabase
    .from('discounts')
    .select('*')
    .eq('id', discountId)
    .single();

  if (discountError || !discount) {
    return NextResponse.json({ success: false, error: 'Discount not found' }, { status: 404 });
  }

  // Fetch Subscribers
  const { data: subscribers, error: subError } = await supabase
    .from('subscribers')
    .select('name, email')
    .eq('is_active', true);

  if (subError) throw subError;

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ success: false, error: 'No active subscribers found.' }, { status: 400 });
  }

  // Setup Nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const storeName = 'GidiamMini';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com';

  const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value} OFF`;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    subject: customSubject,
    html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">${storeName}</h1>
          <h2 style="color: #1f2937; text-align: center;">${discount.name} - ${discountVal}</h2>
          <p>Hi there,</p>
          <p>${customMessage}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            You received this email because you subscribed to exclusive offers.
          </p>
        </div>
      `,
    bcc: subscribers.map((s: any) => s.email).join(',')
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    await transporter.sendMail(mailOptions);
  } else {
    console.warn('SMTP credentials not configured. Skipping actual send for demo.');
    return NextResponse.json({ success: false, error: 'SMTP credentials not configured on server.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Successfully sent email to ${subscribers.length} subscribers.`
  });
}

export const POST = withAdminAuth((request, { supabase }) => notifySubscribers(supabase, request));
