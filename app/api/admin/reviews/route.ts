// app/api/admin/reviews/route.ts - the moderation queue.
//
// Read-only, and paged the same way the activity feed is. Reviews arrive
// 'pending' and the storefront cannot see them, so this list is the entire
// difference between a review being written and a review being published —
// which makes "how many are waiting" the number the page actually opens with.
//
// Unlike the storefront's read, this one returns the private columns:
// author_email, so a moderator can reply to a person rather than to a row, and
// moderation_note, which is theirs.
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { REVIEW_STATUSES } from '@/lib/commerce/reviews';

/** The service-role client withAdminAuth hands every admin route. */
type AdminClient = AdminRouteContext['supabase'];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** The product's name and image, so the queue reads as "this review, of that
 *  product" without a second request per row. */
const ADMIN_REVIEW_SELECT = `
  id, product_id, order_id, rating, title, body, author_name, author_email,
  variant_label, photo_paths, status, moderation_note, admin_response,
  admin_responded_at, is_verified_purchase, created_at, published_at,
  products ( name, main_image ),
  orders ( order_number )
`;

function parseSize(value: string | null): number {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(size), MAX_PAGE_SIZE);
}

/**
 * How many sit in each status, for the filter tabs.
 *
 * Three head-only counts rather than one grouped query: PostgREST has no GROUP
 * BY, and a count with no rows returned is cheap enough that the alternative
 * (a view, or counting client-side over a page) is not worth it.
 */
async function statusCounts(supabase: AdminClient): Promise<Record<string, number>> {
  const counted = await Promise.all(
    REVIEW_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from('product_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      return [status, count ?? 0] as const;
    })
  );

  return Object.fromEntries(counted);
}

async function listReviews(supabase: AdminClient, request: NextRequest) {
  const url = new URL(request.url);
  const pageSize = parseSize(url.searchParams.get('pageSize'));
  const page = Math.max(0, Math.trunc(Number(url.searchParams.get('page')) || 0));
  const status = url.searchParams.get('status');
  const productId = url.searchParams.get('productId');

  let query = supabase
    .from('product_reviews')
    .select(ADMIN_REVIEW_SELECT, { count: 'exact' })
    // Oldest pending first would be the queue's natural order, but this list
    // doubles as "what has been said about us lately" — and the newest review
    // is the one an owner wants to see when they open the page.
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // Checked against the canonical list rather than passed through: this value
  // reaches the query builder.
  if (status && (REVIEW_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }
  if (productId) {
    query = query.eq('product_id', productId);
  }

  const [{ data, error, count }, counts] = await Promise.all([query, statusCounts(supabase)]);

  if (error) {
    console.error('Error reading reviews:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load reviews: ${error.message}`, items: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    // `items`, not `reviews`: the admin's two moderation queues are read by one
    // hook, so their responses have to be the same shape.
    items: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    counts,
  });
}

export const GET = withAdminAuth((request, { supabase }) => listReviews(supabase, request));
