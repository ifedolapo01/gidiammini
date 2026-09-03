// app/api/reviews/route.ts - a customer writing a review.
//
// The only way a review enters the database. There is no unauthenticated form
// behind it and no admin one either: every row is written here, by someone
// holding an invite token for an order that was actually fulfilled.
//
// The token is resolved again on this side rather than trusted from the form.
// The page that rendered the form already resolved it, but a route that
// believes its own client is a route with no gate at all — and the resolve is
// also what tells us which products this order may review, which is the check
// that stops a valid token being used to review the whole catalogue.
//
// Reviews land as 'pending'. Nothing a stranger wrote appears on a product
// page before a human has read it, photos least of all.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { isBotSubmission } from '@/lib/api/schemas/common';
import { reviewSubmissionSchema } from '@/lib/api/schemas/reviews';
import { resolveReviewClaim } from '@/lib/commerce/review-claim';
import { isOwnReviewPhotoPath } from '@/lib/commerce/review-photo';

/** A second review of the same item on the same order. */
const UNIQUE_VIOLATION = '23505';

const THANKS = {
  success: true,
  message: "Thank you — your review is with us. We read every one before it goes live, so it'll appear on the product shortly.",
};

/** Blank optional text is stored as NULL, not as ''. A column that holds both
 *  for "nothing" is a column every reader has to test twice. */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function submitReview(request: NextRequest) {
  const parsed = await parseJsonBody(request, reviewSubmissionSchema);
  if (!parsed.ok) return parsed.response;

  const { token, productId, rating, title, body, authorName, photoPaths } = parsed.data;

  // Answered as success, so a scripted submitter learns nothing from the
  // response about having been spotted.
  if (isBotSubmission(parsed.data)) {
    console.warn('Review honeypot triggered — discarding silently.');
    return NextResponse.json(THANKS);
  }

  const supabase = createAdminClient();

  const claim = await resolveReviewClaim(supabase, token);
  if (!claim.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          claim.reason === 'expired'
            ? 'That review link has expired. Get in touch and we will send you a fresh one.'
            : 'That review link is not valid.',
      },
      { status: claim.reason === 'expired' ? 410 : 403 }
    );
  }

  const item = claim.claim.items.find((candidate) => candidate.productId === productId);

  // Not on the order. The token is real, so this is either a stale form or
  // somebody trying their luck against another product's page.
  if (!item) {
    return NextResponse.json(
      { success: false, error: 'That product is not on this order.' },
      { status: 403 }
    );
  }

  if (item.reviewed) {
    return NextResponse.json(
      { success: false, error: "You've already reviewed this item — thank you." },
      { status: 409 }
    );
  }

  // Every photo has to have been uploaded under this order's own prefix. See
  // review-photo.ts: this is the ownership check, and it is why the paths can
  // travel through the browser at all.
  const photos = photoPaths.filter((path) => isOwnReviewPhotoPath(path, claim.claim.orderId));
  if (photos.length !== photoPaths.length) {
    return NextResponse.json(
      { success: false, error: 'One of those photos could not be attached. Please try adding it again.' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('product_reviews').insert({
    product_id: productId,
    order_id: claim.claim.orderId,
    rating,
    title: orNull(title),
    body: orNull(body),
    author_name: authorName,
    // From the order, never from the form: it is the address the invite was
    // sent to, and a moderator needs to be able to reply to a real person.
    author_email: claim.claim.customerEmail,
    // Also from the order line — the point of showing "bought 3-6M / Cream" is
    // that nobody chose to type it.
    variant_label: item.variantLabel,
    photo_paths: photos,
    is_verified_purchase: true,
    status: 'pending',
  });

  // The unique index got there first: two submits raced, or the form was
  // submitted twice. Either way the review exists, which is what they wanted.
  if (error && error.code === UNIQUE_VIOLATION) {
    return NextResponse.json(THANKS);
  }

  if (error) {
    console.error('Review insert failed:', error.message);
    return NextResponse.json(
      { success: false, error: 'We could not save your review just now. Please try again.' },
      { status: 503 }
    );
  }

  return NextResponse.json(THANKS);
}

export const POST = withRateLimit(
  RATE_LIMITS.reviewSubmit,
  submitReview,
  'Too many reviews at once. Please wait a moment and try again.'
);
