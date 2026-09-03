// app/api/reviews/photos/route.ts - a photo attached to a review.
//
// One image per request, returning the object path to send back with the
// review. Split from the review submit for the same reason checkout uploads
// its receipt before creating the order: an image is multipart and slow, a
// review is JSON and fast, and a shopper should see each photo land rather
// than discover on submit that the whole form was too big.
//
// The invite token is required. Without it this endpoint is an open file host
// on somebody else's storage quota — the token turns it into "a customer who
// bought something may attach a photo of it", which is all it needs to be.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { resolveReviewClaim } from '@/lib/commerce/review-claim';
import {
  buildReviewPhotoPath,
  validateReviewPhoto,
  MAX_REVIEW_PHOTO_BYTES,
} from '@/lib/commerce/review-photo';
import { REVIEW_PHOTOS_BUCKET } from '@/lib/commerce/reviews';

/** Cheap guard before the body is read, so an oversized upload is rejected
 *  without buffering it. The real check still runs on the actual bytes. */
function declaredTooLarge(request: NextRequest): boolean {
  const length = Number(request.headers.get('content-length'));
  // +1MB of slack for multipart overhead.
  return Number.isFinite(length) && length > MAX_REVIEW_PHOTO_BYTES + 1024 * 1024;
}

async function uploadReviewPhoto(request: NextRequest) {
  try {
    if (declaredTooLarge(request)) {
      return NextResponse.json(
        { success: false, error: 'That photo is too large. Please choose one under 5MB.' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('photo');
    const token = formData.get('token');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No photo was attached.' }, { status: 400 });
    }

    const supabase: SupabaseClient = createAdminClient();
    const claim = await resolveReviewClaim(supabase, typeof token === 'string' ? token : null);

    if (!claim.ok) {
      return NextResponse.json(
        { success: false, error: 'That review link is no longer valid, so the photo was not saved.' },
        { status: 403 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateReviewPhoto(file.type, bytes.byteLength, bytes);

    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // Prefixed with the order id, which is what lets the review submit verify
    // that a path belongs to the order attaching it.
    const path = buildReviewPhotoPath(claim.claim.orderId, validation.extension);

    const { error } = await supabase.storage
      .from(REVIEW_PHOTOS_BUCKET)
      .upload(path, bytes, { contentType: validation.mime, upsert: false });

    if (error) {
      console.error('Review photo upload failed:', error);
      return NextResponse.json(
        { success: false, error: 'We could not save that photo. Please try again.' },
        { status: 502 }
      );
    }

    // The path, not a URL. The product page builds the public URL when it
    // renders a published review, so nothing stored here is a link.
    return NextResponse.json({ success: true, path });
  } catch (error: any) {
    console.error('Error handling review photo upload:', error);
    return NextResponse.json(
      { success: false, error: 'We could not process that photo. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  RATE_LIMITS.reviewPhoto,
  uploadReviewPhoto,
  'Too many uploads. Please wait a moment and try again.'
);
