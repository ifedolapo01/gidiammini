/**
 * COMMERCE layer — validating an uploaded image, whatever it is an image of.
 *
 * Extracted from receipt-file.ts when customer review photos became a second
 * upload endpoint. The rule that matters is identical in both places and worth
 * stating once: a browser's declared MIME type is just a string in a multipart
 * header, so it is checked *and* corroborated against the file's magic bytes.
 * Without that, "Content-Type: image/png" on an arbitrary payload is enough to
 * park anything in a storage bucket.
 *
 * The wording differs per endpoint — "choose your receipt again" is wrong
 * advice on a review form — so the messages take the caller's nouns. The
 * checks do not vary.
 *
 * Pure and dependency-free, so both callers can be unit tested without a
 * Supabase client.
 */

/** Accepted types, each paired with the extension used for the stored object.
 *  SVG is deliberately absent: it is a document that can carry script. */
const ACCEPTED = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AcceptedImageType = keyof typeof ACCEPTED;

/** Human-readable list for error messages and UI copy. */
export const ACCEPTED_IMAGE_LABEL = 'JPG, PNG or WebP';

/** The `accept` attribute for a file input that matches what this accepts. */
export const ACCEPTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

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

export type ImageValidation =
  | { ok: true; mime: AcceptedImageType; extension: string }
  | { ok: false; error: string };

export interface ImageValidationOptions {
  maxBytes: number;
  /** What the customer would call the file: "your receipt", "your photo". */
  retryNoun: string;
  /** Appended to the "doesn't look like an image" message, when the endpoint
   *  can say something more useful about what it wanted. */
  hint?: string;
}

/**
 * Validates an upload: declared type is accepted, size is within the limit,
 * and the bytes match the declared type.
 */
export function validateImageUpload(
  declaredType: string,
  size: number,
  bytes: Uint8Array,
  { maxBytes, retryNoun, hint }: ImageValidationOptions
): ImageValidation {
  const mime = declaredType.toLowerCase().trim() as AcceptedImageType;

  if (!(mime in ACCEPTED)) {
    return { ok: false, error: `That file type isn't supported. Please upload a ${ACCEPTED_IMAGE_LABEL} image.` };
  }

  if (size <= 0) {
    return { ok: false, error: `That file appears to be empty. Please choose ${retryNoun} again.` };
  }

  if (size > maxBytes) {
    const mb = (size / 1024 / 1024).toFixed(1);
    const limit = Math.round(maxBytes / 1024 / 1024);
    return { ok: false, error: `That file is ${mb}MB. Please upload an image under ${limit}MB.` };
  }

  if (!magicBytesMatch(bytes, mime)) {
    const suffix = hint ? ` ${hint}` : '';
    return { ok: false, error: `That file doesn't look like a ${ACCEPTED_IMAGE_LABEL} image.${suffix}` };
  }

  return { ok: true, mime, extension: ACCEPTED[mime] };
}

/**
 * A storage object path: a caller-chosen prefix, then a random file name.
 *
 * Random rather than derived from anything about the order, the customer or
 * the time — the receipts bucket learned this the hard way, where
 * {orderNumber}-{timestamp}.jpg was guessable and the order number is "UT"
 * plus a truncated timestamp.
 */
export function randomObjectPath(prefix: string, extension: string): string {
  return `${prefix}/${crypto.randomUUID()}.${extension}`;
}
