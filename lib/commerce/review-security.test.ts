/**
 * The three places a review crosses a trust boundary.
 *
 *   * The invite token, which is the entire proof-of-purchase gate — there is
 *     no login behind this feature, so possession of the token is the
 *     credential and its shape check is the first line of the lookup.
 *   * The photo path, whose order-id prefix is what stops a review carrying a
 *     photo somebody else uploaded.
 *   * The moderation plan, because publishing is what puts a stranger's words
 *     and pictures on a product page.
 */
import { describe, it, expect } from 'vitest';
import { hashReviewToken, isReviewTokenShape, newReviewToken } from './review-token';
import { buildReviewPhotoPath, isOwnReviewPhotoPath, validateReviewPhoto } from './review-photo';
import { planModeration } from './review-moderation';

describe('review tokens', () => {
  it('generates tokens of the shape the route accepts', () => {
    const token = newReviewToken();
    expect(isReviewTokenShape(token)).toBe(true);
  });

  it('never repeats one', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newReviewToken()));
    expect(tokens.size).toBe(200);
  });

  it('hashes to a stable 64-character digest, and never stores the token', () => {
    const token = newReviewToken();
    const hash = hashReviewToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashReviewToken(token));
    expect(hash).not.toContain(token);
  });

  it('rejects anything that is not token-shaped before a database round trip', () => {
    expect(isReviewTokenShape('')).toBe(false);
    expect(isReviewTokenShape('short')).toBe(false);
    expect(isReviewTokenShape(null)).toBe(false);
    // A path traversal or SQL fragment cannot even reach the lookup.
    expect(isReviewTokenShape('../../etc/passwd')).toBe(false);
    expect(isReviewTokenShape("' OR 1=1--")).toBe(false);
  });
});

describe('review photo paths', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const other = '99999999-9999-4999-8999-999999999999';

  it('prefixes the path with the order, which is what proves ownership', () => {
    const path = buildReviewPhotoPath(orderId, 'jpg');
    expect(path).toMatch(new RegExp(`^${orderId}/[0-9a-f-]{36}\\.jpg$`));
    expect(isOwnReviewPhotoPath(path, orderId)).toBe(true);
  });

  it("refuses another order's photo", () => {
    const path = buildReviewPhotoPath(other, 'jpg');
    expect(isOwnReviewPhotoPath(path, orderId)).toBe(false);
  });

  it('refuses a path that is not one we could have produced', () => {
    expect(isOwnReviewPhotoPath(`${orderId}/../../receipts/secret.jpg`, orderId)).toBe(false);
    expect(isOwnReviewPhotoPath(`${orderId}/photo.svg`, orderId)).toBe(false);
    expect(isOwnReviewPhotoPath('https://evil.example/x.jpg', orderId)).toBe(false);
  });

  it('validates the bytes, not the header', () => {
    const png = new Uint8Array(64);
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((byte, i) => (png[i] = byte));

    expect(validateReviewPhoto('image/png', 64, png)).toMatchObject({ ok: true, extension: 'png' });
    expect(validateReviewPhoto('image/png', 64, new TextEncoder().encode('<svg onload=x>')).ok).toBe(false);
  });
});

describe('planModeration', () => {
  const row = { status: 'pending', published_at: null, photo_paths: ['a/b.jpg'] };

  it('stamps published_at when a review is first published', () => {
    const plan = planModeration({ status: 'published' }, row);
    expect(plan.update.status).toBe('published');
    expect(plan.update.published_at).toBeTypeOf('string');
    expect(plan.action).toBe('approve');
  });

  it('keeps the original published_at when a pulled review is restored', () => {
    const plan = planModeration(
      { status: 'published' },
      { status: 'pending', published_at: '2026-01-01T00:00:00.000Z', photo_paths: [] }
    );
    expect(plan.update).not.toHaveProperty('published_at');
  });

  it('takes the photos with a rejection', () => {
    const plan = planModeration({ status: 'rejected' }, row);
    expect(plan.action).toBe('reject');
    expect(plan.photosToDelete).toEqual(['a/b.jpg']);
    expect(plan.update.photo_paths).toEqual([]);
  });

  it('leaves unmentioned fields alone, and clears one set to empty', () => {
    expect(planModeration({ adminResponse: 'Thank you!' }, row).update).toMatchObject({
      admin_response: 'Thank you!',
    });

    const cleared = planModeration({ adminResponse: '' }, row).update;
    expect(cleared.admin_response).toBeNull();
    expect(cleared.admin_responded_at).toBeNull();
    // The status was not mentioned, so it is not in the update at all.
    expect(cleared).not.toHaveProperty('status');
  });

  it('produces no update when the requested status is already the current one', () => {
    expect(planModeration({ status: 'pending' }, row).update).toEqual({});
  });
});
