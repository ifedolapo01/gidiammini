-- ============================================================================
-- Reviews: the only evidence a stranger has that anyone bought here before
-- ----------------------------------------------------------------------------
-- Checkout asks someone to transfer money to an account number and then wait.
-- There is no card network standing behind that, no chargeback, and — until
-- this migration — nothing anywhere on the page suggesting another human had
-- ever done it and been happy. Trust is the binding constraint on a
-- transfer-first checkout, and reviews are the cheapest trust available: the
-- customers who already paid write them.
--
-- They pay for themselves twice more. Review text is indexable long-tail
-- content about products whose own descriptions are two lines, and an
-- aggregateRating in the product's JSON-LD is what puts stars in a search
-- listing.
--
-- VERIFIED PURCHASE IS THE GATE, NOT A BADGE
--
-- There is no public "write a review" form. A review can only be written by
-- someone holding an invite token, and a token only exists for an order that
-- reached a fulfilled status. So every row here is a real purchase, which is
-- worth more than a larger pile of reviews that might not be — and it means
-- the spam problem this table would otherwise have does not exist.
--
-- The token is stored as a SHA-256 hash, never in the clear. Hashing happens
-- in Node (lib/commerce/review-token.ts) rather than in SQL: digest() lives in
-- the `extensions` schema on hosted Supabase and does not resolve unqualified.
--
-- MODERATION IS OPT-IN, NOT OPT-OUT
--
-- Rows land as 'pending' and are invisible to the storefront until an admin
-- publishes them. A default of 'published' would mean the one review nobody
-- vetted is the one on the page — and photos, which customers upload here, are
-- exactly the thing you want a human to look at first.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  /**
   * The order this review came from — the proof of purchase, kept so a
   * disputed review can be traced back to a real transaction.
   *
   * SET NULL rather than CASCADE: deleting an order is a bookkeeping act and
   * must not silently delete published content the storefront is ranking for.
   * is_verified_purchase stays true, because it was true when it was written.
   */
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,

  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),

  /** Both optional. A rating on its own is a complete review — demanding an
   *  essay is how you end up with no reviews at all. */
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  body  text CHECK (body  IS NULL OR char_length(body)  <= 4000),

  /** What is displayed next to the review. A first name is plenty; the form
   *  defaults it from the order and lets them change it. */
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 1 AND 80),

  /**
   * Never rendered anywhere. Kept so a moderator can reply to the person who
   * wrote something that needs a conversation rather than a publish decision.
   */
  author_email text NOT NULL,

  /** Which variant they actually bought, e.g. "3-6M · Cream". Copied from the
   *  order line, not chosen in the form — the point is that it is evidence. */
  variant_label text CHECK (variant_label IS NULL OR char_length(variant_label) <= 120),

  /**
   * Object paths inside the public `review-photos` bucket. Paths, never URLs —
   * same rule as orders.receipt_path, so nothing can drift into rendering a
   * stored string as a link to somewhere else.
   */
  photo_paths text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(photo_paths) <= 4),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),

  /** Internal only — why a moderator rejected it. Never sent to the customer:
   *  a rejection notice is an invitation to argue about a rejection. */
  moderation_note text CHECK (moderation_note IS NULL OR char_length(moderation_note) <= 1000),

  /** The shop's public reply, shown under the review. A shop that answers its
   *  two-star reviews reads as more trustworthy than one with none. */
  admin_response text CHECK (admin_response IS NULL OR char_length(admin_response) <= 2000),
  admin_responded_at timestamptz,

  /**
   * True for every row written through the invite flow, which is currently the
   * only way in. It exists as a column rather than being assumed so that an
   * unverified source (an imported review, a form opened up later) is
   * distinguishable instead of quietly inheriting the badge.
   */
  is_verified_purchase boolean NOT NULL DEFAULT false,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- The storefront read: this product's published reviews, newest first.
CREATE INDEX IF NOT EXISTS product_reviews_published_idx
  ON public.product_reviews (product_id, created_at DESC)
  WHERE status = 'published';

-- The moderation queue, and the admin list filtered by status.
CREATE INDEX IF NOT EXISTS product_reviews_status_idx
  ON public.product_reviews (status, created_at DESC);

-- One review per product per order. An invite link is for the order, so
-- without this the same buyer could post the same item twenty times and the
-- average rating would be theirs alone.
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_one_per_order_item_idx
  ON public.product_reviews (order_id, product_id)
  WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.product_reviews IS
  'Customer reviews, gated on a verified purchase via order_review_invites and published only after admin moderation. Holds an email address, so anon has no grant of any kind — the storefront reads it server-side.';

CREATE OR REPLACE FUNCTION public.touch_product_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS product_reviews_touch_updated_at ON public.product_reviews;
CREATE TRIGGER product_reviews_touch_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_reviews_updated_at();

-- ---------------------------------------------------------------------------
-- 2. The invitation
-- ---------------------------------------------------------------------------
-- One row per order, not per item: the buyer gets one link and rates whatever
-- they bought behind it. Two links for a two-item order is two emails and half
-- the response rate.
CREATE TABLE IF NOT EXISTS public.order_review_invites (
  order_id uuid PRIMARY KEY REFERENCES public.orders (id) ON DELETE CASCADE,

  /** SHA-256 of the token that went out in the email. The plaintext exists
   *  only in that email and in the URL the customer clicks — a dump of this
   *  table is not a licence to write reviews as other people. */
  token_hash text NOT NULL UNIQUE,

  /** Null means the row was claimed but the mail has not gone out yet. The
   *  send is best-effort and must never fail an order status change, so these
   *  two facts are recorded separately. */
  sent_at timestamptz,

  /** A review invite is not a permanent credential. Long enough that someone
   *  who reads mail monthly still gets there. */
  expires_at timestamptz NOT NULL DEFAULT now() + interval '120 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_review_invites IS
  'One review invitation per order, holding a SHA-256 hash of the emailed token. Possession of the token is the verified-purchase proof; there is no other way to write a review.';

-- ---------------------------------------------------------------------------
-- 3. The aggregate
-- ---------------------------------------------------------------------------
-- A view rather than maintained counters on products, for the same reason
-- rebuild_product_pairs() is a full recompute: a derived number that is
-- recalculated cannot disagree with the rows it is derived from, and there is
-- no state to repair when a moderator un-publishes something. Published rows
-- only — a pending review must not move the star rating before a human has
-- read it.
--
-- The per-star counts are here too, so the distribution bars under the summary
-- are one row rather than five queries.
CREATE OR REPLACE VIEW public.product_review_stats AS
  SELECT r.product_id,
         count(*)::integer                                  AS review_count,
         round(avg(r.rating)::numeric, 2)                   AS rating_average,
         count(*) FILTER (WHERE r.rating = 5)::integer      AS five_star,
         count(*) FILTER (WHERE r.rating = 4)::integer      AS four_star,
         count(*) FILTER (WHERE r.rating = 3)::integer      AS three_star,
         count(*) FILTER (WHERE r.rating = 2)::integer      AS two_star,
         count(*) FILTER (WHERE r.rating = 1)::integer      AS one_star,
         count(*) FILTER (WHERE r.is_verified_purchase)::integer AS verified_count
    FROM public.product_reviews r
   WHERE r.status = 'published'
   GROUP BY r.product_id;

COMMENT ON VIEW public.product_review_stats IS
  'Published-review aggregate per product: count, average and the star distribution. Read server-side for ProductCard stars and the product page''s aggregateRating.';

-- ---------------------------------------------------------------------------
-- 4. Lock it all down
-- ---------------------------------------------------------------------------
-- Reviews are public content, but this table is not a public table: it holds
-- the reviewer's email address, the moderator's private notes, and rows nobody
-- has approved yet. The storefront reads it through the service role and sends
-- only the fields it means to show. Consistent with 20251101001700's rule that
-- anon holds no grant on anything.
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_review_invites ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('product_reviews', 'order_review_invites')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.product_reviews      FROM anon, authenticated;
REVOKE ALL ON public.order_review_invites FROM anon, authenticated;
REVOKE ALL ON public.product_review_stats FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Somewhere to put the photos
-- ---------------------------------------------------------------------------
-- Public, unlike `receipts`: a review photo is content the product page shows
-- to everybody, and signing a URL per image per render would buy nothing. What
-- keeps it safe is that nothing but the server can write here — uploads go
-- through /api/reviews/photos, which checks the bytes are really a JPEG, PNG
-- or WebP and puts them on a random path. No anon or authenticated policy is
-- created, so the browser cannot write to the bucket at all.
--
-- Only id/name/public are set: the columns for size and MIME limits have moved
-- between Supabase versions, and the route enforces both anyway.
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ---------------------------------------------------------------------------
-- 6. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'table'  AS item, 'product_reviews'      AS name, count(*)::text AS detail FROM public.product_reviews
UNION ALL
SELECT 'table',  'order_review_invites', count(*)::text FROM public.order_review_invites
UNION ALL
SELECT 'bucket', id, CASE WHEN public THEN 'PUBLIC' ELSE 'private' END
  FROM storage.buckets WHERE id = 'review-photos'
 ORDER BY item, name;
