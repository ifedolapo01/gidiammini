/**
 * Request schemas for writing and moderating a review.
 *
 * The public one is the interesting half. It carries an invite token, which is
 * the whole authorisation story for this endpoint — there is no session and no
 * account, so the token is checked against order_review_invites before
 * anything is written. Everything else here is shape and length, built from
 * the shared field primitives so a review body is capped the same way a
 * contact message is.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText, requiredText, honeypotFields } from './common';
import { MAX_REVIEW_BODY, MAX_REVIEW_PHOTOS, MAX_REVIEW_TITLE, REVIEW_STATUSES } from '@/lib/commerce/reviews';

/** Matches isReviewTokenShape — base64url of 32 random bytes. */
const tokenField = z
  .string({ error: 'That review link is not valid.' })
  .trim()
  .regex(/^[A-Za-z0-9_-]{40,64}$/, 'That review link is not valid.');

const productIdField = z.string().uuid('That product could not be identified.');

/**
 * A review from the invite form.
 *
 * The rating is the only required field. Title, body and photos are all
 * optional because a five-star rating with nothing written is still true, and
 * every mandatory box is a reason to abandon the form — which costs the shop
 * the review it was asking for.
 */
export const reviewSubmissionSchema = z.object({
  ...honeypotFields,
  token: tokenField,
  productId: productIdField,
  rating: z
    .number({ error: 'Please choose a star rating.' })
    .int('Please choose a star rating.')
    .min(1, 'Please choose a star rating.')
    .max(5, 'Please choose a star rating.'),
  title: optionalText('A review title', MAX_REVIEW_TITLE),
  body: optionalText('Your review', MAX_REVIEW_BODY),
  /** Prefilled from the order and editable — some people would rather appear
   *  as "Ada O." than by their full name. */
  authorName: requiredText('Your name', MAX_LENGTHS.name),
  /**
   * Object paths returned by /api/reviews/photos, not URLs and not files. The
   * route re-checks each one against the order the token resolves to; this
   * only caps how many can arrive.
   */
  photoPaths: z
    .array(z.string().trim().max(200))
    .max(MAX_REVIEW_PHOTOS, `Please attach at most ${MAX_REVIEW_PHOTOS} photos.`)
    .optional()
    .transform((paths) => paths ?? []),
});

export type ReviewSubmissionBody = z.infer<typeof reviewSubmissionSchema>;

/** The photo upload's fields. The file itself arrives as multipart, so only
 *  the token travels as a value. */
export const reviewPhotoTokenSchema = tokenField;

/**
 * A field a PATCH may leave alone.
 *
 * Deliberately not optionalText(), which turns an absent value into '': that
 * would make every moderation request clear the fields it did not mention.
 * Here undefined means "leave it", and '' means "clear it" — the distinction a
 * partial update is built on.
 */
function editableText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional();
}

/**
 * A moderator's decision.
 *
 * Status and response are independent: publishing and replying are two
 * different acts, and an admin often does one without the other. At least one
 * has to be present, or the request is a no-op that would still write an audit
 * entry claiming something changed.
 */
export const reviewModerationSchema = z
  .object({
    status: z.enum(REVIEW_STATUSES).optional(),
    /** Internal. Never mailed to the reviewer — see the column comment. */
    moderationNote: editableText('A note', 1000),
    /** The shop's public reply, shown under the review. Empty string clears it. */
    adminResponse: editableText('A response', 2000),
  })
  .refine(
    (body) => body.status !== undefined || body.adminResponse !== undefined || body.moderationNote !== undefined,
    { error: 'Nothing to change.' }
  );

export type ReviewModerationBody = z.infer<typeof reviewModerationSchema>;
