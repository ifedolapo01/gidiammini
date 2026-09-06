import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { SITE_URL } from '@/lib/site-url';
import { sendMarketingCampaign } from '@/lib/notifications/marketing';
import { escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

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
    // id, because the unsubscribe link is derived from it.
    .select('id, name, email')
    .eq('is_active', true);

  if (subError) throw subError;

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ success: false, error: 'No active subscribers found.' }, { status: 400 });
  }

  const storeName = 'GidiamMini';
  const siteUrl = SITE_URL;

  const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value} OFF`;

  const buildCampaignHtml = (unsubscribeFooterHtml: string) => `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">${storeName}</h1>
          <h2 style="color: #1f2937; text-align: center;">${discount.name} - ${discountVal}</h2>
          <p>Hi there,</p>
          <p>${escapeHtmlWithBreaks(customMessage)}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
          </div>
          ${unsubscribeFooterHtml}
        </div>
      `;

  // One message per subscriber, each with its own opt-out link. This was a
  // single BCC to the whole list, which cannot carry a working unsubscribe --
  // see lib/notifications/marketing.ts. Same change as the discounts cron.
  const result = await sendMarketingCampaign({
    recipients: subscribers.map((s: any) => ({ id: s.id, email: s.email, name: s.name })),
    subject: sanitizeHeader(customSubject),
    buildHtml: ({ unsubscribeFooterHtml }) => buildCampaignHtml(unsubscribeFooterHtml),
  });

  if (result.refused) {
    return NextResponse.json(
      {
        success: false,
        error:
          'This deployment cannot sign unsubscribe links, so no campaign was sent. ' +
          'Set UNSUBSCRIBE_SECRET and try again.',
      },
      { status: 503 }
    );
  }

  // Reports what actually went out. The old version reported the size of the
  // list whatever happened, which is the same overstatement the notifications
  // log exists to end.
  return NextResponse.json({
    success: result.sent > 0,
    message:
      result.failed > 0
        ? `Sent to ${result.sent} of ${subscribers.length} subscribers. ${result.failed} did not go out.`
        : `Sent to ${result.sent} subscriber${result.sent === 1 ? '' : 's'}.`,
    sent: result.sent,
    failed: result.failed,
  });
}

export const POST = withAdminAuth((request, { supabase }) => notifySubscribers(supabase, request));
