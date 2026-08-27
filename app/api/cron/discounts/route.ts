import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { computeDiscountPhase } from '@/lib/commerce/discount-phase';
import { asNotifiedPhases } from '@/lib/commerce/db-narrowing';
import { sendBulkEmail } from '@/lib/email';
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';

export const maxDuration = 300; // Allows up to 5 minutes for sending emails

export async function GET(req: NextRequest) {
  // 1. Verify Vercel Cron Secret to ensure only Vercel can trigger this
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const now = new Date();

    // 2. Fetch Active Discounts
    const { data: discounts, error: discountError } = await supabase
      .from('discounts')
      .select('*')
      .eq('is_active', true);

    if (discountError) throw discountError;

    if (!discounts || discounts.length === 0) {
      return NextResponse.json({ success: true, message: 'No active discounts.' });
    }

    // 2.5 Automatically deactivate expired discounts
    const expiredIds = discounts
      .filter((d) => d.end_date && new Date(d.end_date) < now)
      .map((d) => d.id);

    if (expiredIds.length > 0) {
      await supabase
        .from('discounts')
        .update({ is_active: false })
        .in('id', expiredIds);
    }

    // Filter out expired discounts so we don't send emails for them
    const validDiscounts = discounts.filter((d) => !expiredIds.includes(d.id));

    if (validDiscounts.length === 0) {
      return NextResponse.json({ success: true, message: `Deactivated ${expiredIds.length} expired discounts. No active discounts remaining.` });
    }

    const storeName = 'GidiamMini';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com';

    let emailsSent = 0;
    let discountsProcessed = 0;
    
    // Lazy load subscribers only if we need to send an email
    let subscribers: any[] | null = null;

    // 4. Process each discount
    for (const discount of validDiscounts) {
      const notifiedPhases = asNotifiedPhases(discount.notified_phases);

      const computedPhase = computeDiscountPhase(discount, now);

      // If we should notify and haven't yet for this phase
      if (computedPhase !== 'NONE' && !notifiedPhases.includes(computedPhase)) {
        
        // Fetch subscribers if not already fetched
        if (!subscribers) {
          const { data, error: subError } = await supabase
            .from('subscribers')
            .select('name, email')
            .eq('is_active', true);
          if (subError) throw subError;
          subscribers = data || [];
        }

        if (subscribers.length > 0) {
          const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₦${discount.value} OFF`;

          let title = '';
          let bodyText = '';

          if (computedPhase === 'STARTING_SOON') {
            title = 'Coming Soon!';
            bodyText = `Our <strong>${escapeHtml(discount.name)}</strong> starts very soon! Get ready to enjoy <strong>${discountVal}</strong> your purchases.`;
          } else if (computedPhase === 'DAY_1') {
            title = 'Sale is Live!';
            bodyText = `We just launched our <strong>${escapeHtml(discount.name)}</strong>. Enjoy <strong>${discountVal}</strong> your purchases while stock lasts!`;
          } else if (computedPhase === 'MIDDLE_DAY') {
            title = 'Still Going Strong!';
            bodyText = `Don't miss out on our active <strong>${escapeHtml(discount.name)}</strong>. We're halfway through, get <strong>${discountVal}</strong> now!`;
          } else if (computedPhase === 'LAST_DAY') {
            title = 'Last Chance!';
            bodyText = `Time is running out! Grab your favorites with <strong>${discountVal}</strong> before the ${escapeHtml(discount.name)} expires tonight.`;
          }

          const html = `
              <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #2563eb; text-align: center;">${storeName}</h1>
                <h2 style="color: #1f2937;">${title}</h2>
                <p>Hi there,</p>
                <p>${bodyText}</p>
                <p>The discount will automatically apply at checkout for eligible items.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${siteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
                </div>
                <p style="color: #6b7280; font-size: 12px; text-align: center;">
                  You received this email because you subscribed to exclusive offers.
                </p>
              </div>
            `;

          const result = await sendBulkEmail(subscribers.map(s => s.email), sanitizeHeader(`${title} ${discount.name} - ${discountVal}!`), html);
          if (result.success) {
            emailsSent += subscribers.length;
          }
          discountsProcessed++;

          // Update notified_phases in DB
          const newPhases = [...notifiedPhases, computedPhase];
          await supabase
            .from('discounts')
            .update({ notified_phases: newPhases })
            .eq('id', discount.id);
        } else {
          // No subscribers to notify — still mark as notified so we don't recheck every run.
          const newPhases = [...notifiedPhases, computedPhase];
          await supabase
            .from('discounts')
            .update({ notified_phases: newPhases })
            .eq('id', discount.id);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Triggered emails for ${discountsProcessed} discounts. Sent ${emailsSent} emails total.` 
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
