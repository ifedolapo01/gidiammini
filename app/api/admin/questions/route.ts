// app/api/admin/questions/route.ts - the unanswered-question queue.
//
// Read-only, and the same shape as the review queue so the admin's two
// moderation surfaces are driven by one hook. The difference is what "pending"
// means: a pending review is waiting for a yes/no, a pending question is
// waiting for somebody to write the answer — which is work, not a decision,
// and the reason this list is ordered oldest-first.
//
// Returns the private columns the storefront never sees: asker_email, so the
// answer can be attributed to a real person, and moderation_note.
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { QUESTION_STATUSES } from '@/lib/commerce/questions';

/** The service-role client withAdminAuth hands every admin route. */
type AdminClient = AdminRouteContext['supabase'];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ADMIN_QUESTION_SELECT = `
  id, product_id, body, asker_name, asker_email, answer, answered_at, answered_by,
  answer_notified_at, status, moderation_note, created_at, published_at,
  products ( name, main_image )
`;

function parseSize(value: string | null): number {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(size), MAX_PAGE_SIZE);
}

/** How many sit in each status, for the filter tabs. Head-only counts. */
async function statusCounts(supabase: AdminClient): Promise<Record<string, number>> {
  const counted = await Promise.all(
    QUESTION_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from('product_questions')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      return [status, count ?? 0] as const;
    })
  );

  return Object.fromEntries(counted);
}

async function listQuestions(supabase: AdminClient, request: NextRequest) {
  const url = new URL(request.url);
  const pageSize = parseSize(url.searchParams.get('pageSize'));
  const page = Math.max(0, Math.trunc(Number(url.searchParams.get('page')) || 0));
  const status = url.searchParams.get('status');
  const productId = url.searchParams.get('productId');

  let query = supabase
    .from('product_questions')
    .select(ADMIN_QUESTION_SELECT, { count: 'exact' })
    // Oldest first, unlike the review queue: somebody is waiting for an answer,
    // and the one who has waited longest should be at the top.
    .order('created_at', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // Checked against the canonical list rather than passed through: this value
  // reaches the query builder.
  if (status && (QUESTION_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }
  if (productId) {
    query = query.eq('product_id', productId);
  }

  const [{ data, error, count }, counts] = await Promise.all([query, statusCounts(supabase)]);

  if (error) {
    console.error('Error reading questions:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load questions: ${error.message}`, items: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    items: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    counts,
  });
}

export const GET = withAdminAuth((request, { supabase }) => listQuestions(supabase, request));
