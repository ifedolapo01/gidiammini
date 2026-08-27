import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { sendOrderEmail } from '@/lib/email';
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

/** Hidden form field. A human never sees it, so anything in it came from a bot
 * filling every input on the page. Answered with a success response rather than
 * an error, so a scripted submitter gets no signal that it was detected. */
function isBotSubmission(body: Record<string, unknown>): boolean {
  const trap = body.website ?? body.company_url;
  return typeof trap === 'string' && trap.trim().length > 0;
}


async function subscribeToNewsletter(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name } = body;

    if (isBotSubmission(body)) {
      console.warn('Newsletter honeypot triggered — discarding silently.');
      return NextResponse.json({ success: true });
    }

    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createAdminClient();

    // 1. Save Subscriber
    const { error } = await supabase
      .from('subscribers')
      .upsert(
        { email, name, is_active: true },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Subscription error:', error);
      return NextResponse.json({ success: true, warning: 'Failed to save to database' });
    }

    // 2. Check for active/upcoming discounts
    const now = new Date();
    const { data: discounts } = await supabase
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .in('scope', ['SITEWIDE', 'CATEGORY']);

    if (discounts && discounts.length > 0) {
      // Find the most relevant one
      const sorted = [...discounts].sort((a, b) => {
        const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
        return aStart - bStart;
      });

      let best = sorted.find(d => {
        if (!d.start_date) return true;
        const end = d.end_date ? new Date(d.end_date) : new Date(8640000000000000);
        return now < end;
      });

      if (best) {
        const storeName = 'GidiamMini';
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com';
        const discountVal = best.type === 'PERCENTAGE' ? `${best.value}% OFF` : `₦${best.value} OFF`;

        const start = best.start_date ? new Date(best.start_date) : now;
        
        let title = '';
        let message = '';
        
        if (now < start) {
          title = 'Get Ready for Savings!';
          const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          message = `Welcome to our newsletter! Get ready for our upcoming <strong>${escapeHtml(best.name)}</strong>. Enjoy <strong>${discountVal}</strong> starting on <strong>${dateStr} at ${timeStr}</strong>!`;
        } else {
          title = 'Welcome! Enjoy Your Discount';
          message = `Welcome to our newsletter! We currently have an active offer: <strong>${escapeHtml(best.name)}</strong>. Enjoy <strong>${discountVal}</strong> your purchases right now!`;
        }

        const html = `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb; text-align: center;">${storeName}</h1>
              <h2 style="color: #1f2937;">${title}</h2>
              <p>Hi ${escapeHtml(name)},</p>
              <p>${message}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${siteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
              </div>
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                You received this email because you subscribed to exclusive offers at checkout.
              </p>
            </div>
          `;

        const result = await sendOrderEmail(email, sanitizeHeader(`${title} - ${best.name}`), html);
        if (!result.success) {
          console.error('Welcome email failed:', result.error);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Subscription exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.subscribe,
  subscribeToNewsletter,
  'Too many signup attempts. Please try again later.'
);
