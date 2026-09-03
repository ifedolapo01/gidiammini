// lib/notifications/templates/question-answered-email.ts
// The mail that closes the loop: you asked, here is the answer.
//
// This is the entire reason the ask form requires an email address, and the
// difference between a Q&A section and a suggestion box. Somebody with a
// question about a product is somebody deciding whether to buy it, and an
// answer that arrives while they are still deciding is worth more than the
// same answer sitting on a page they may never come back to.
//
// So the answer is *in* the email, not behind the link. The link is there to
// buy the thing.
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Storefront pink — this one goes to a shopper, not to the admin. */
const ACCENT = '#db2777';

export interface QuestionAnsweredEmailParams {
  askerName: string;
  productName: string;
  productUrl: string;
  question: string;
  answer: string;
}

export interface QuestionAnsweredEmailContent {
  subject: string;
  html: string;
}

export function buildQuestionAnsweredEmail(
  params: QuestionAnsweredEmailParams
): QuestionAnsweredEmailContent {
  const { askerName, productName, productUrl, question, answer } = params;

  const subject = sanitizeHeader(`Answered: your question about the ${productName}`);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${ACCENT}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .qa { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT}; }
        .label { margin: 0 0 4px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        .cta { display: inline-block; background: ${ACCENT}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 8px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>We've answered your question</h1>
        <p>Hello ${escapeHtml(askerName)},</p>
      </div>
      <div class="content">
        <p>You asked us about the <strong>${escapeHtml(productName)}</strong>. Here's the answer:</p>

        <div class="qa">
          <p class="label">Your question</p>
          <p style="margin: 0 0 16px;">${escapeHtmlWithBreaks(question)}</p>

          <p class="label">Our answer</p>
          <p style="margin: 0;">${escapeHtmlWithBreaks(answer)}</p>
        </div>

        <div style="text-align: center;">
          <a href="${escapeHtml(productUrl)}" class="cta">View the product</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          The question and answer are now on the product page too, so the next
          person wondering the same thing does not have to ask. If that did not
          quite cover it, reply to this email and we will take another go.
        </p>

        <div class="footer">
          <p>You received this because you asked a question about a product on our site. It's a one-off — you're not subscribed to anything.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
