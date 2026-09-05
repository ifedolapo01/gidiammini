// lib/notifications/templates/segment-email.ts
// A message to a segment, in the shop's own frame.
//
// The discount broadcast (app/api/admin/discounts/notify) builds its own
// markup inline and looks nothing like the emails the same customer gets about
// their orders. This one goes through buildEmailShell, so a segment message
// arrives looking like it came from the same shop — which is most of what
// makes an unexpected email read as legitimate rather than as spam.
//
// The body is the admin's own words and nothing else. No offer block, no
// product grid, no "Shop now" the admin did not write: whoever is sending this
// knows what they want to say, and a template that decorates it will sooner or
// later contradict it.
import { buildEmailShell } from './email-shell';
import { buildTrackOrderButton } from './track-order-cta';
import { escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** The admin theme's primary. A segment message is from the shop, not about an
 * order, so it borrows no status colour. */
const ACCENT = '#2563eb';

export interface SegmentEmailParams {
  subject: string;
  message: string;
}

export interface SegmentEmailContent {
  subject: string;
  html: string;
}

export function buildSegmentEmail(params: SegmentEmailParams): SegmentEmailContent {
  const body = `
        <div class="panel">
          <p>${escapeHtmlWithBreaks(params.message)}</p>
        </div>

        ${buildTrackOrderButton(ACCENT)}`;

  return {
    subject: sanitizeHeader(params.subject),
    html: buildEmailShell({
      accentColor: ACCENT,
      heading: '💌 A note from GidiamMini',
      body,
      contactPrompt: 'Want to talk to us?',
    }),
  };
}
