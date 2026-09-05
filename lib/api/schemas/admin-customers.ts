/**
 * Request schemas for the admin customer editor and segment campaigns.
 *
 * Only the operational fields are writable. Identity — email, phone — is
 * maintained from checkout by lib/commerce/customer-identity.ts; letting an
 * admin edit it here would silently detach the record from the orders that
 * resolve to it by email.
 */
import { z } from 'zod';
import { MAX_LENGTHS, optionalText, requiredText } from './common';

/**
 * One segment tag.
 *
 * Lower-cased and trimmed here as well as by the database trigger. The trigger
 * is the guarantee; this is so the value the admin sees echoed back is the
 * value that was stored, rather than the one they typed.
 */
const tagField = z
  .string({ error: 'A tag must be text.' })
  .trim()
  .toLowerCase()
  .min(1, 'A tag cannot be blank.')
  .max(40, 'A tag must be 40 characters or fewer.')
  // Spaces are allowed — "repeat buyer" is a segment somebody will want — but
  // the characters that would make a tag unsearchable are not.
  .regex(/^[a-z0-9][a-z0-9 _-]*$/, 'Tags may use letters, numbers, spaces, hyphens and underscores.');

export const customerUpdateSchema = z.object({
  is_blocked: z.boolean({ error: 'Blocked must be true or false.' }),
  blocked_reason: optionalText('Reason', MAX_LENGTHS.note),
  notes: optionalText('Notes', MAX_LENGTHS.message),
  /**
   * Omitted leaves the tags alone; an empty array clears them.
   *
   * The whole set every time, not a patch. Two admins editing one customer's
   * tags is rare enough that last-write-wins is honest, and an add/remove API
   * would need a merge rule that nobody would ever exercise.
   */
  tags: z.array(tagField).max(20, 'A customer can carry at most 20 tags.').nullish(),
});

export type CustomerUpdateBody = z.infer<typeof customerUpdateSchema>;

/**
 * A message to a segment.
 *
 * Deliberately narrow: a subject, a body, and the tag that decides who gets
 * it. No scheduling, no templates, no per-recipient merge fields — this is the
 * "message everyone who has ever bought wholesale" job the shop currently does
 * by copying addresses out of a spreadsheet, and anything more is a mailing
 * platform rather than a shop admin.
 */
export const customerCampaignSchema = z.object({
  tag: requiredText('Tag', 40).toLowerCase(),
  subject: requiredText('Subject', 200),
  message: requiredText('Message', MAX_LENGTHS.message),
  /** Send for real. Without it the route reports who would receive it and
   * sends nothing — see the route for why that is the default. */
  confirm: z.boolean().nullish().transform((value) => value === true),
});

export type CustomerCampaignBody = z.infer<typeof customerCampaignSchema>;
