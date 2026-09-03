/**
 * COMMERCE layer — review photos: what is accepted, and where it lands.
 *
 * A photo of the thing actually being worn is the most persuasive object on a
 * product page, and it is the one thing the shop cannot produce itself. So
 * customers upload them — which makes this an unauthenticated-ish write path
 * into a public bucket, and that is worth being careful about.
 *
 * Three things keep it honest:
 *
 *   1. The bytes are checked, not the header. Shared with receipts — see
 *      image-file.ts.
 *   2. Only an invite holder can upload. /api/reviews/photos resolves the
 *      token first, so the bucket is not an open file host.
 *   3. The object path is prefixed with the order's id, and the review that
 *      references it must belong to that same order. That is what stops one
 *      person attaching a path they did not upload — the check is a string
 *      comparison rather than an existence query, so it costs nothing.
 *
 * The order id in the path is not a secret: reading an order still requires
 * its order number plus the email or phone it was placed with.
 *
 * Pure, so all of the above is testable without a bucket.
 */
import { randomObjectPath, validateImageUpload, type ImageValidation } from './image-file';

/** Same ceiling as a receipt: it is a phone photo either way. */
export const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateReviewPhoto(
  declaredType: string,
  size: number,
  bytes: Uint8Array
): ImageValidation {
  return validateImageUpload(declaredType, size, bytes, {
    maxBytes: MAX_REVIEW_PHOTO_BYTES,
    retryNoun: 'your photo',
    hint: 'Please upload a photo taken with your phone or camera.',
  });
}

/** `<order id>/<random uuid>.<ext>` — see rule 3 above. */
export function buildReviewPhotoPath(orderId: string, extension: string): string {
  return randomObjectPath(orderId, extension);
}

const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

/**
 * True when the path is one this module could have produced, for this order.
 *
 * Both halves matter. The shape check keeps an arbitrary string out of the
 * column; the prefix check is the ownership test, so a review can only carry
 * photos uploaded under its own order.
 */
export function isOwnReviewPhotoPath(path: string, orderId: string): boolean {
  return PHOTO_PATH.test(path) && path.startsWith(`${orderId}/`);
}
