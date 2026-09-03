// app/api/questions/route.ts - a shopper asking about a product.
//
// The one write in the reviews/Q&A feature with no purchase behind it, by
// design: the person asking is the person who has not bought yet, and gating
// this would mean only existing customers could ask — which is nobody who
// needed to.
//
// So the defences are the contact form's, and moderation is what actually
// keeps the product page clean: nothing submitted here is visible until an
// admin has read it and written an answer under it.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { isBotSubmission } from '@/lib/api/schemas/common';
import { askQuestionSchema } from '@/lib/api/schemas/questions';

/**
 * The same answer whether the question was saved or the honeypot caught it.
 *
 * It also sets the expectation the feature actually meets: the answer arrives
 * by email, and the question appears on the page once it has one.
 */
const RECEIVED = {
  success: true,
  message: "Thanks — we've got your question. We'll email you the answer, and post it on this page so the next person doesn't have to ask.",
};

async function askQuestion(request: NextRequest) {
  const parsed = await parseJsonBody(request, askQuestionSchema);
  if (!parsed.ok) return parsed.response;

  const { productId, question, name, email } = parsed.data;

  // Answered as success, so a scripted submitter gets no signal it was caught.
  if (isBotSubmission(parsed.data)) {
    console.warn('Question honeypot triggered — discarding silently.');
    return NextResponse.json(RECEIVED);
  }

  const supabase = createAdminClient();

  // The product has to exist and be listed. Without this the table becomes a
  // place to write arbitrary text against arbitrary uuids.
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (!product) {
    return NextResponse.json(
      { success: false, error: 'That product is no longer available.' },
      { status: 404 }
    );
  }

  const { error } = await supabase.from('product_questions').insert({
    product_id: productId,
    body: question,
    asker_name: name,
    // Never displayed. It is here so the answer can reach them, which is the
    // difference between a Q&A section and a suggestion box.
    asker_email: email,
    status: 'pending',
  });

  if (error) {
    console.error('Question insert failed:', error.message);
    return NextResponse.json(
      { success: false, error: 'We could not save your question just now. Please try again.' },
      { status: 503 }
    );
  }

  return NextResponse.json(RECEIVED);
}

export const POST = withRateLimit(
  RATE_LIMITS.askQuestion,
  askQuestion,
  'Too many questions at once. Please wait a moment and try again.'
);
