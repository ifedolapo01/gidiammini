// app/api/admin/questions/[id]/route.ts - answering, publishing, rejecting.
//
// The interesting difference from the review queue: this route sends an email.
// Publishing an answer is the moment the person who asked should hear about it
// — they gave an email address for exactly that and nothing else — so the
// notification is attached to the transition rather than left as a second
// thing for an admin to remember.
//
// It is also the route that enforces "publishing requires an answer", via
// planQuestionModeration. See that module for why an unanswered published
// question is worse than no Q&A section at all.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAdminAuth, type AdminRouteContext, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { readForAudit } from '@/lib/api/audit';
import { questionModerationSchema } from '@/lib/api/schemas/questions';
import {
  planQuestionModeration,
  type ModeratedQuestionRow,
} from '@/lib/commerce/question-moderation';
import { notifyIfAnswerPublished, type AnsweredQuestion } from '@/lib/commerce/question-notify';

/** The service-role client withAdminAuth hands every admin route. */
type AdminClient = AdminRouteContext['supabase'];

const AUDIT_COLUMNS =
  'id, product_id, body, asker_name, asker_email, answer, answered_at, answered_by, answer_notified_at, status, published_at, moderation_note';

/** A function, not a shared constant: a Response body can only be read once. */
const notFound = () =>
  NextResponse.json({ success: false, error: 'That question no longer exists.' }, { status: 404 });

async function moderateQuestion(
  request: NextRequest,
  supabase: AdminClient,
  id: string,
  actorEmail: string | null,
  audit: AuditRecorder
) {
  const parsed = await parseJsonBody(request, questionModerationSchema);
  if (!parsed.ok) return parsed.response;

  // Read first: an update overwrites the only copy of the old values, and the
  // plan needs the current answer to decide whether publishing is allowed.
  const before = await readForAudit(supabase, 'product_questions', id, AUDIT_COLUMNS);
  if (!before) return notFound();

  const plan = planQuestionModeration(
    parsed.data,
    before as unknown as ModeratedQuestionRow,
    actorEmail
  );

  // The one rule this feature refuses to bend. A 422 rather than a 400: the
  // request was well formed, it just asked for a state the product page should
  // never be in.
  if (!plan.ok) {
    return NextResponse.json({ success: false, error: plan.error }, { status: 422 });
  }

  if (Object.keys(plan.update).length === 0) {
    return NextResponse.json({ success: true, item: before, unchanged: true });
  }

  const { data, error } = await supabase
    .from('product_questions')
    .update(plan.update)
    .eq('id', id)
    .select(AUDIT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('Question moderation failed:', error.message);
    return NextResponse.json(
      { success: false, error: `Could not update that question: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data) return notFound();

  audit({
    entityType: 'product_question',
    entityId: id,
    action: plan.action,
    before,
    after: data,
    reason: parsed.data.moderationNote || null,
  });

  // After the row, and never allowed to fail it. `publishes` is true only on
  // the request that actually put the answer on the page.
  const notified = await notifyIfAnswerPublished(
    supabase,
    data as unknown as AnsweredQuestion,
    plan.publishes
  );

  return NextResponse.json({ success: true, item: data, notified: notified.sent });
}

/**
 * Hard delete.
 *
 * Rejecting is the normal answer to a question that should not be on the site
 * — it keeps the row, so the decision is reviewable. Delete is for content
 * that should not exist anywhere: a phone number in the question body, abuse,
 * somebody's address.
 */
async function deleteQuestion(supabase: AdminClient, id: string, audit: AuditRecorder) {
  const before = await readForAudit(supabase, 'product_questions', id, AUDIT_COLUMNS);
  if (!before) return notFound();

  const { error } = await supabase.from('product_questions').delete().eq('id', id);

  if (error) {
    console.error('Question delete failed:', error.message);
    return NextResponse.json(
      { success: false, error: `Could not delete that question: ${error.message}` },
      { status: 500 }
    );
  }

  audit({ entityType: 'product_question', entityId: id, action: 'delete', before });

  return NextResponse.json({ success: true });
}

export const PATCH = withAdminAuth(async (request, { supabase, params, actor, audit }) => {
  const { id } = await params;
  return moderateQuestion(request, supabase, id, actor.email, audit);
});

export const DELETE = withAdminAuth(async (_request, { supabase, params, audit }) => {
  const { id } = await params;
  return deleteQuestion(supabase, id, audit);
});
