// app/api/admin/reviews/[id]/route.ts - publishing, rejecting and replying.
//
// Publishing a review is the one admin action here that changes what a
// stranger sees on a product page, which is why it is audited by name
// ('approve' / 'reject') rather than as a generic update: "who put this on the
// site" is a question somebody eventually asks.
//
// Nothing invalidates the storefront cache from this file. withAdminAuth drops
// the products tag after every successful admin mutation, and the review reads
// are cached under that same tag on purpose — so a publish shows up on the
// product page immediately, with no invalidation call for a future route to
// forget.
import { NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { readForAudit } from '@/lib/api/audit';
import type { AuditRecorder } from '@/lib/api/with-admin-auth';

type AdminClient = AdminRouteContext['supabase'];
import { reviewModerationSchema } from '@/lib/api/schemas/reviews';
import {
  planModeration,
  removeReviewPhotos,
  type ModeratedRow,
} from '@/lib/commerce/review-moderation';
import type { NextRequest } from 'next/server';

const AUDIT_COLUMNS = 'id, product_id, rating, status, published_at, admin_response, moderation_note, photo_paths';

/** A function, not a shared constant: a Response body can only be read once,
 *  so one instance handed to two requests is a bug waiting for traffic. */
const notFound = () =>
  NextResponse.json({ success: false, error: 'That review no longer exists.' }, { status: 404 });

async function moderateReview(
  request: NextRequest,
  supabase: AdminClient,
  id: string,
  audit: AuditRecorder
) {
  const parsed = await parseJsonBody(request, reviewModerationSchema);
  if (!parsed.ok) return parsed.response;

  // Read first: an update overwrites the only copy of the old values, and the
  // plan needs to know the current status to decide what the change means.
  const before = await readForAudit(supabase, 'product_reviews', id, AUDIT_COLUMNS);
  if (!before) return notFound();

  const plan = planModeration(parsed.data, before as unknown as ModeratedRow);

  if (Object.keys(plan.update).length === 0) {
    // The schema guarantees the body asked for something; landing here means
    // it asked for what is already true.
    return NextResponse.json({ success: true, review: before, unchanged: true });
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .update(plan.update)
    .eq('id', id)
    .select(AUDIT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('Review moderation failed:', error.message);
    return NextResponse.json(
      { success: false, error: `Could not update that review: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data) return notFound();

  audit({
    entityType: 'product_review',
    entityId: id,
    action: plan.action,
    before,
    after: data,
    reason: parsed.data.moderationNote || null,
  });

  // After the row, and never allowed to fail it — see removeReviewPhotos.
  await removeReviewPhotos(supabase, plan.photosToDelete);

  return NextResponse.json({ success: true, review: data });
}

/**
 * Hard delete, photos included.
 *
 * Rejecting is the normal answer to a review that should not be on the site:
 * it keeps the row, so the decision is reviewable and the same person cannot
 * simply post it again. Delete is for content that should not exist anywhere —
 * a customer's phone number in the body, someone else's photo — so it takes
 * the objects with it.
 */
async function deleteReview(supabase: AdminClient, id: string, audit: AuditRecorder) {
  const before = await readForAudit(supabase, 'product_reviews', id, AUDIT_COLUMNS);
  if (!before) return notFound();

  const { error } = await supabase.from('product_reviews').delete().eq('id', id);

  if (error) {
    console.error('Review delete failed:', error.message);
    return NextResponse.json(
      { success: false, error: `Could not delete that review: ${error.message}` },
      { status: 500 }
    );
  }

  audit({ entityType: 'product_review', entityId: id, action: 'delete', before });

  await removeReviewPhotos(supabase, ((before.photo_paths ?? []) as string[]));

  return NextResponse.json({ success: true });
}

export const PATCH = withAdminAuth(async (request, { supabase, params, audit }) => {
  const { id } = await params;
  return moderateReview(request, supabase, id, audit);
});

export const DELETE = withAdminAuth(async (_request, { supabase, params, audit }) => {
  const { id } = await params;
  return deleteReview(supabase, id, audit);
});
