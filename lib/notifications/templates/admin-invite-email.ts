// lib/notifications/templates/admin-invite-email.ts
// The email that hands somebody the keys to the shop.
//
// Sent through this app's own SMTP transport rather than Supabase's built-in
// mailer, so an invitation is delivered by the same infrastructure as every
// other message the store sends — one place to configure, one place to debug
// when it does not arrive.
//
// The copy names who invited them and what the role can do. An admin invite
// that says only "you have been invited" is indistinguishable from a phishing
// attempt, and the person receiving it has no way to judge it.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Admin blue — this goes to a colleague, not a shopper. Matches --primary in
 * the .theme-admin token scope and adminConfig.primaryColorHex. */
const ACCENT = '#2563eb';

export interface AdminInviteEmailParams {
  /** What to call the invitee, when a name was given. */
  name: string | null;
  /** The admin who sent the invitation, for "who is this from". */
  invitedBy: string | null;
  roleLabel: string;
  roleDescription: string;
  storeName: string;
  /** The Supabase action link that lets them set a password. */
  inviteUrl: string;
}

export interface AdminInviteEmailContent {
  subject: string;
  html: string;
}

export function buildAdminInviteEmail(params: AdminInviteEmailParams): AdminInviteEmailContent {
  const { name, invitedBy, roleLabel, roleDescription, storeName, inviteUrl } = params;

  const greeting = name?.trim() ? `Hello ${escapeHtml(name.trim())},` : 'Hello,';
  const from = invitedBy?.trim() ? escapeHtml(invitedBy.trim()) : 'The store owner';
  const subject = sanitizeHeader(`You have been invited to ${storeName}`);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${ACCENT}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .box { background: white; padding: 24px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT}; text-align: center; }
        .role { background: white; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .cta { display: inline-block; background: ${ACCENT}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(storeName)}</h1>
        <p>${greeting}</p>
      </div>
      <div class="content">
        <p>${from} has given you an admin account for <strong>${escapeHtml(storeName)}</strong>.</p>

        <div class="role">
          <p style="margin: 0; font-weight: bold;">Your role: ${escapeHtml(roleLabel)}</p>
          <p style="margin: 6px 0 0; color: #6b7280; font-size: 14px;">${escapeHtml(roleDescription)}</p>
        </div>

        <div class="box">
          <a href="${escapeHtml(inviteUrl)}" class="cta">Set your password</a>
          <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">
            Choose a password nobody else knows. This account is yours alone —
            everything you do in the admin is recorded against your name.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          If the button does not work, copy this into your browser:<br>
          <span style="word-break: break-all;">${escapeHtml(inviteUrl)}</span>
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          <strong>Not expecting this?</strong> Ignore this email and no account is
          ever used. Tell ${from} that you received it.
        </p>

        <div class="footer">
          <p>You received this because somebody with owner access invited you to administer this store.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
