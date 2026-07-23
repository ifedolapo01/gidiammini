import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { sendBulkEmail } from '@/lib/email';

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

  const storeName = 'GidiamMini';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com';

  const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value} OFF`;

  const html = `
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
      `;

  const result = await sendBulkEmail(subscribers.map((s: any) => s.email), customSubject, html);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to send email.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Successfully sent email to ${subscribers.length} subscribers.`
  });
}

export const POST = withAdminAuth((request, { supabase }) => notifySubscribers(supabase, request));
