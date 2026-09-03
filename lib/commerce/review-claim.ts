/**
 * COMMERCE layer (server only) — turning an invite token into what may be reviewed.
 *
 * This is the verified-purchase gate itself, and it is the only one: there is
 * no public review form, so every review that exists came through here. Both
 * callers use it — the /review/[token] page to render the form, and the POST
 * that saves a review to re-check the claim. The route does not trust the page
 * to have checked; it resolves the token again.
 *
 * What it answers is deliberately narrow: "which products did this order
 * actually contain, and which of them has this order already reviewed". The
 * order's address, total and payment state are none of a review form's
 * business and never leave this module.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashReviewToken, isReviewTokenShape } from './review-token';
import { variantLabel } from './product-variants';

export interface ReviewableItem {
  productId: string;
  /** The name as it was bought, from the order line — so a since-renamed
   *  product still reads as the thing they received. */
  productName: string;
  image: string | null;
  /** "3-6M / Cream", or "Standard" when the product has no variants. */
  variantLabel: string;
  /** True once a review exists for this order and product. The form shows it
   *  as done rather than dropping it, so the customer can see they already
   *  said something instead of wondering where the item went. */
  reviewed: boolean;
}

export interface ReviewClaim {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: ReviewableItem[];
}

/** Every reason a token can fail to resolve, so the page can say something
 *  true. 'expired' is worth distinguishing: it is the one a customer can act
 *  on, by asking for a new link. */
export type ReviewClaimFailure = 'invalid' | 'expired';

export type ReviewClaimResult =
  | { ok: true; claim: ReviewClaim }
  | { ok: false; reason: ReviewClaimFailure };

interface OrderItemRow {
  product_id: string | null;
  product_name: string;
  size: string | null;
  color: string | null;
  products: { main_image: string | null } | null;
}

/**
 * Resolves a token, or explains why it did not.
 *
 * The lookup is an equality match on the stored SHA-256, which is a unique
 * index — the plaintext token is never held anywhere to be compared against.
 */
export async function resolveReviewClaim(
  supabase: SupabaseClient,
  token: string | null | undefined
): Promise<ReviewClaimResult> {
  // Shape-checked before the database is touched, so a crawler walking
  // /review/<junk> costs nothing.
  if (!isReviewTokenShape(token)) return { ok: false, reason: 'invalid' };

  const { data: invite, error } = await supabase
    .from('order_review_invites')
    .select('order_id, expires_at')
    .eq('token_hash', hashReviewToken(token as string))
    .maybeSingle();

  if (error) {
    console.error('Review invite lookup failed:', error.message);
    return { ok: false, reason: 'invalid' };
  }
  if (!invite) return { ok: false, reason: 'invalid' };

  if (new Date((invite as { expires_at: string }).expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const orderId = (invite as { order_id: string }).order_id;

  const { data: order } = await supabase
    .from('orders')
    .select(
      `order_number, customer_name, customer_email,
       order_items ( product_id, product_name, size, color, products ( main_image ) )`
    )
    .eq('id', orderId)
    .maybeSingle();

  // The invite row cascades with the order, so this means the order was
  // deleted between the lookup and now. Nothing to review.
  if (!order) return { ok: false, reason: 'invalid' };

  const { data: existing } = await supabase
    .from('product_reviews')
    .select('product_id')
    .eq('order_id', orderId);

  const alreadyReviewed = new Set(
    ((existing ?? []) as Array<{ product_id: string }>).map((row) => row.product_id)
  );

  const typed = order as unknown as {
    order_number: string;
    customer_name: string;
    customer_email: string;
    order_items: OrderItemRow[] | null;
  };

  return {
    ok: true,
    claim: {
      orderId,
      orderNumber: typed.order_number,
      customerName: typed.customer_name,
      customerEmail: typed.customer_email,
      items: reviewableItems(typed.order_items ?? [], alreadyReviewed),
    },
  };
}

/**
 * One entry per product, not per order line.
 *
 * A single order can hold the same product twice in two sizes, and the unique
 * index allows one review per (order, product) — so the form has to offer one
 * too, or its second entry would be rejected on submit with nothing useful to
 * say. Lines with no product_id (a product deleted since the order) are
 * dropped: there is nothing left to attach a review to.
 */
function reviewableItems(rows: OrderItemRow[], alreadyReviewed: Set<string>): ReviewableItem[] {
  const byProduct = new Map<string, ReviewableItem>();

  for (const row of rows) {
    if (!row.product_id || byProduct.has(row.product_id)) continue;

    byProduct.set(row.product_id, {
      productId: row.product_id,
      productName: row.product_name,
      image: row.products?.main_image ?? null,
      variantLabel: variantLabel({ size: row.size, color: row.color }),
      reviewed: alreadyReviewed.has(row.product_id),
    });
  }

  return [...byProduct.values()];
}
