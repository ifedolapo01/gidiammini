/**
 * COMMERCE layer — validation for customer-uploaded payment receipts.
 *
 * A browser's reported MIME type is just a string in a multipart header, so it
 * is checked *and* corroborated against the file's magic bytes. Without that,
 * "Content-Type: image/png" on an arbitrary payload is enough to park anything
 * in the storage bucket.
 *
 * Pure and dependency-free so it can be unit tested without a Supabase client.
 */

/** The private storage bucket receipts live in. */
export const RECEIPTS_BUCKET = 'receipts';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB — matches the UI copy

/** Accepted types, each paired with the extension used for the stored object. */
const ACCEPTED = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AcceptedReceiptType = keyof typeof ACCEPTED;

/** Human-readable list for error messages and UI copy. */
export const ACCEPTED_RECEIPT_LABEL = 'JPG, PNG or WebP';

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/** True when the bytes really are the image format they claim to be. */
export function magicBytesMatch(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false;

  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

export type ReceiptValidation =
  | { ok: true; mime: AcceptedReceiptType; extension: string }
  | { ok: false; error: string };

/**
 * Validates a receipt upload: declared type is accepted, size is within limit,
 * and the bytes match the declared type.
 */
export function validateReceipt(
  declaredType: string,
  size: number,
  bytes: Uint8Array
): ReceiptValidation {
  const mime = declaredType.toLowerCase().trim() as AcceptedReceiptType;

  if (!(mime in ACCEPTED)) {
    return { ok: false, error: `That file type isn't supported. Please upload a ${ACCEPTED_RECEIPT_LABEL} image.` };
  }

  if (size <= 0) {
    return { ok: false, error: 'That file appears to be empty. Please choose your receipt again.' };
  }

  if (size > MAX_RECEIPT_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(1);
    return { ok: false, error: `That file is ${mb}MB. Please upload an image under 5MB.` };
  }

  if (!magicBytesMatch(bytes, mime)) {
    return { ok: false, error: `That file doesn't look like a ${ACCEPTED_RECEIPT_LABEL} image. Please upload a screenshot of your transfer.` };
  }

  return { ok: true, mime, extension: ACCEPTED[mime] };
}

/**
 * Object path for a newly uploaded receipt. Deliberately random rather than
 * derived from the order number: the old {orderNumber}-{timestamp}.jpg scheme
 * was guessable, since order numbers are "UT" plus a truncated timestamp.
 * Bucketed by date only to keep the object listing navigable.
 */
export function buildReceiptPath(extension: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `${day}/${crypto.randomUUID()}.${extension}`;
}
