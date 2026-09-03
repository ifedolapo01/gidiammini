/**
 * COMMERCE layer — validation for customer-uploaded payment receipts.
 *
 * The checks themselves now live in image-file.ts, shared with review photo
 * uploads: a declared MIME type is a caller-chosen header, so it is
 * corroborated against the file's magic bytes. What stays here is everything
 * specific to a receipt — the bucket, the 5MB the checkout UI promises, the
 * date-bucketed object path, and wording that talks about a transfer
 * screenshot rather than about a photo.
 *
 * Pure and dependency-free so it can be unit tested without a Supabase client.
 */
import {
  ACCEPTED_IMAGE_LABEL,
  randomObjectPath,
  validateImageUpload,
  type AcceptedImageType,
  type ImageValidation,
} from './image-file';

// Re-exported so a caller (or a test) reaching for receipt validation gets the
// whole surface from one import, as it did before the split.
export { magicBytesMatch } from './image-file';
export type AcceptedReceiptType = AcceptedImageType;

/** The private storage bucket receipts live in. */
export const RECEIPTS_BUCKET = 'receipts';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB — matches the UI copy

/** Human-readable list for error messages and UI copy. */
export const ACCEPTED_RECEIPT_LABEL = ACCEPTED_IMAGE_LABEL;

export type ReceiptValidation = ImageValidation;

/**
 * Validates a receipt upload: declared type is accepted, size is within limit,
 * and the bytes match the declared type.
 */
export function validateReceipt(
  declaredType: string,
  size: number,
  bytes: Uint8Array
): ReceiptValidation {
  return validateImageUpload(declaredType, size, bytes, {
    maxBytes: MAX_RECEIPT_BYTES,
    retryNoun: 'your receipt',
    hint: 'Please upload a screenshot of your transfer.',
  });
}

/**
 * Object path for a newly uploaded receipt. Deliberately random rather than
 * derived from the order number: the old {orderNumber}-{timestamp}.jpg scheme
 * was guessable, since order numbers are "UT" plus a truncated timestamp.
 * Bucketed by date only to keep the object listing navigable.
 */
export function buildReceiptPath(extension: string, now = new Date()): string {
  return randomObjectPath(now.toISOString().slice(0, 10), extension);
}
