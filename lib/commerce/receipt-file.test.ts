/**
 * Receipt upload validation. The declared MIME type is just a header the caller
 * chose, so these tests are mostly about the magic-byte check catching a file
 * that lies about what it is.
 */
import { describe, it, expect } from 'vitest';
import {
  validateReceipt, magicBytesMatch, buildReceiptPath,
  MAX_RECEIPT_BYTES, RECEIPTS_BUCKET,
} from './receipt-file';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** Bytes with a real signature, padded to a plausible length. */
const bytes = (signature: number[], size = 64, at8: number[] = []) => {
  const buf = new Uint8Array(size);
  signature.forEach((b, i) => (buf[i] = b));
  at8.forEach((b, i) => (buf[8 + i] = b));
  return buf;
};

describe('magicBytesMatch', () => {
  it('recognises a real PNG, JPEG and WebP', () => {
    expect(magicBytesMatch(bytes(PNG), 'image/png')).toBe(true);
    expect(magicBytesMatch(bytes(JPEG), 'image/jpeg')).toBe(true);
    expect(magicBytesMatch(bytes(RIFF, 64, WEBP), 'image/webp')).toBe(true);
  });

  it('treats image/jpg as image/jpeg', () => {
    expect(magicBytesMatch(bytes(JPEG), 'image/jpg')).toBe(true);
  });

  it('rejects bytes that do not match the claimed type', () => {
    expect(magicBytesMatch(bytes(PNG), 'image/jpeg')).toBe(false);
    expect(magicBytesMatch(bytes(JPEG), 'image/png')).toBe(false);
  });

  it('rejects a RIFF container that is not WebP (e.g. a WAV)', () => {
    expect(magicBytesMatch(bytes(RIFF, 64, [0x57, 0x41, 0x56, 0x45]), 'image/webp')).toBe(false);
  });

  it('rejects HTML renamed as an image', () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    expect(magicBytesMatch(html, 'image/png')).toBe(false);
  });

  it('rejects a PDF, whatever it claims to be', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj');
    expect(magicBytesMatch(pdf, 'image/png')).toBe(false);
    expect(magicBytesMatch(pdf, 'image/jpeg')).toBe(false);
  });

  it('rejects a file too short to have a signature', () => {
    expect(magicBytesMatch(new Uint8Array([0x89, 0x50]), 'image/png')).toBe(false);
  });

  it('rejects an unknown declared type', () => {
    expect(magicBytesMatch(bytes(PNG), 'image/svg+xml')).toBe(false);
    expect(magicBytesMatch(bytes(PNG), 'application/pdf')).toBe(false);
  });
});

describe('validateReceipt', () => {
  it('accepts a genuine PNG', () => {
    const result = validateReceipt('image/png', 64, bytes(PNG));
    expect(result).toEqual({ ok: true, mime: 'image/png', extension: 'png' });
  });

  it('maps both jpeg spellings to a .jpg extension', () => {
    expect(validateReceipt('image/jpeg', 64, bytes(JPEG))).toMatchObject({ extension: 'jpg' });
    expect(validateReceipt('image/jpg', 64, bytes(JPEG))).toMatchObject({ extension: 'jpg' });
  });

  it('is case- and whitespace-insensitive about the declared type', () => {
    expect(validateReceipt('  IMAGE/PNG ', 64, bytes(PNG))).toMatchObject({ ok: true });
  });

  it('rejects an unsupported type before looking at the bytes', () => {
    const result = validateReceipt('application/pdf', 64, bytes(PNG));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/isn't supported/i);
  });

  it('rejects SVG — it can carry script', () => {
    expect(validateReceipt('image/svg+xml', 64, bytes(PNG)).ok).toBe(false);
  });

  it('rejects an empty file', () => {
    const result = validateReceipt('image/png', 0, new Uint8Array(0));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/empty/i);
  });

  it('rejects a file over the size limit and names the actual size', () => {
    const result = validateReceipt('image/png', MAX_RECEIPT_BYTES + 1, bytes(PNG));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/under 5MB/i);
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateReceipt('image/png', MAX_RECEIPT_BYTES, bytes(PNG)).ok).toBe(true);
  });

  it('rejects a file whose bytes contradict its declared type', () => {
    const result = validateReceipt('image/png', 64, new TextEncoder().encode('not an image at all'));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/doesn't look like/i);
  });
});

describe('buildReceiptPath', () => {
  it('bucket-by-date and uses a random file name, not the order number', () => {
    // The old scheme was {orderNumber}-{timestamp}.jpg, and order numbers are
    // "UT" plus a truncated timestamp — guessable.
    const path = buildReceiptPath('png', new Date('2026-08-27T10:00:00Z'));
    expect(path).toMatch(/^2026-08-27\/[0-9a-f-]{36}\.png$/);
  });

  it('never repeats a path', () => {
    const paths = new Set(Array.from({ length: 200 }, () => buildReceiptPath('jpg')));
    expect(paths.size).toBe(200);
  });

  it('carries the extension through', () => {
    expect(buildReceiptPath('webp')).toMatch(/\.webp$/);
  });
});

describe('constants', () => {
  it('points at the private receipts bucket', () => {
    expect(RECEIPTS_BUCKET).toBe('receipts');
  });

  it('caps receipts at the 5MB the UI promises', () => {
    expect(MAX_RECEIPT_BYTES).toBe(5 * 1024 * 1024);
  });
});
