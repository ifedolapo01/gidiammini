/**
 * COMMERCE layer — what a moderator's decision does to a row.
 *
 * The arithmetic of moderation, kept out of the route so it can be tested
 * without a request: which columns a PATCH touches, which timestamps follow
 * from a status change, and which audit action describes it.
 *
 * The one judgement call encoded here is that rejecting a review deletes its
 * photos. A rejected review's text sits in a table nobody reads, but its
 * photos would stay fetchable by URL in a public bucket — and a photo is the
 * most likely reason a review was rejected in the first place. Removing them
 * is the point of the rejection, not a side effect of it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditAction } from '@/lib/api/audit';
import { REVIEW_PHOTOS_BUCKET, type ReviewStatus } from './reviews';

export interface ModerationInput {
  status?: ReviewStatus;
  moderationNote?: string;
  adminResponse?: string;
}

export interface ModerationPlan {
  update: Record<string, unknown>;
  action: AuditAction;
  /** Photos to remove from storage once the row has been updated. */
  photosToDelete: string[];
}

export interface ModeratedRow {
  status: string;
  published_at: string | null;
  photo_paths: string[] | null;
}

/**
 * Turns a validated PATCH body into the row update it implies.
 *
 * Absent fields are left alone; an empty string clears one. That distinction
 * is why the schema does not default these to '' — see editableText.
 */
export function planModeration(input: ModerationInput, existing: ModeratedRow): ModerationPlan {
  const update: Record<string, unknown> = {};
  const now = new Date().toISOString();
  let action: AuditAction = 'update';
  const photosToDelete: string[] = [];

  if (input.status && input.status !== existing.status) {
    update.status = input.status;

    if (input.status === 'published') {
      action = 'approve';
      // Stamped once. Re-publishing something that was pulled and restored
      // keeps its original date, because that is when the shopper wrote it and
      // what the page displays.
      if (!existing.published_at) update.published_at = now;
    }

    if (input.status === 'rejected') {
      action = 'reject';
      photosToDelete.push(...(existing.photo_paths ?? []));
      // The column is cleared alongside the objects, so nothing renders a path
      // whose file has gone.
      update.photo_paths = [];
    }
  }

  if (input.moderationNote !== undefined) {
    update.moderation_note = input.moderationNote || null;
  }

  if (input.adminResponse !== undefined) {
    update.admin_response = input.adminResponse || null;
    // Cleared with the response: a timestamp on a reply that no longer exists
    // is a fact about nothing.
    update.admin_responded_at = input.adminResponse ? now : null;
  }

  return { update, action, photosToDelete };
}

/**
 * Deletes photo objects. Best-effort: the row has already been updated by the
 * time this runs, and a storage hiccup must not turn a completed moderation
 * decision into an error the admin retries.
 */
export async function removeReviewPhotos(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(REVIEW_PHOTOS_BUCKET).remove(paths);
  if (error) {
    console.error(`Review photo cleanup failed for ${paths.length} object(s):`, error.message);
  }
}
