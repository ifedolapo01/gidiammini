-- ============================================================================
-- Questions and answers: the doubt that stops a sale, answered in public
-- ----------------------------------------------------------------------------
-- Reviews (20251101003300) are evidence from people who already bought. This
-- is the other half: the person who has not bought yet, and has one specific
-- question — will this fit a chunky six-month-old, is the cotton lined, does
-- the christening gown come with the bonnet. Today they either guess, or they
-- message WhatsApp and wait, or they leave.
--
-- Answering in public answers it once. Every question is a sentence a customer
-- wrote in their own words about a product whose description is two lines, and
-- the answer is the shop's own copy written against a real objection — which
-- is both the best product copy available and the long-tail text this
-- catalogue does not otherwise have.
--
-- WHY THIS IS NOT GATED THE WAY REVIEWS ARE
--
-- A review is a claim about a purchase, so it needs proof of one. A question
-- is the opposite: the whole point is that it comes from somebody who has not
-- bought and is deciding whether to. So asking is open to anyone, and the
-- defences are the ones the contact form uses — a honeypot, a rate limit, and
-- length caps — plus the same rule reviews have: nothing is visible until a
-- human has read it.
--
-- PUBLISHING REQUIRES AN ANSWER
--
-- Enforced in the API (lib/commerce/question-moderation.ts), not here, because
-- a CHECK would also forbid the intermediate states an admin form moves
-- through. The reasoning matters though: a published question with no answer
-- under it is a visible unanswered doubt on the product page, which is worse
-- for trust than no Q&A section at all. It reads as "somebody asked and nobody
-- could be bothered".
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The questions, and their answers
-- ---------------------------------------------------------------------------
-- One table, not two. An answer has no life of its own: it cannot exist
-- without its question, there is exactly one per question, and every read
-- wants both. A second table would buy a join and nothing else.
CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,

  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),

  /** Displayed beside the question. A first name is plenty. */
  asker_name text NOT NULL CHECK (char_length(btrim(asker_name)) BETWEEN 1 AND 80),

  /**
   * Never rendered. This is the only reason the field is required: it is how
   * the answer gets back to the person who asked, which is the difference
   * between a Q&A section and a suggestion box.
   */
  asker_email text NOT NULL,

  /** The shop's public answer. Null until somebody writes one. */
  answer text CHECK (answer IS NULL OR char_length(btrim(answer)) BETWEEN 1 AND 2000),
  answered_at timestamptz,
  /** Which admin answered, for the trail. Free text — the admin is one shared
   *  login, so this is an email address rather than a foreign key. */
  answered_by text,

  /** Set when the "your question has been answered" email goes out. Null means
   *  it has not, which is what keeps a retry from mailing twice. */
  answer_notified_at timestamptz,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),

  /** Internal only, same as product_reviews.moderation_note. */
  moderation_note text CHECK (moderation_note IS NULL OR char_length(moderation_note) <= 1000),

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- The storefront read: this product's answered questions.
--
-- Oldest first, unlike reviews. A question asked early is usually the obvious
-- one everybody has, and the answer to it has had the longest to be corrected;
-- newest-first would bury it under whatever was asked this week.
CREATE INDEX IF NOT EXISTS product_questions_published_idx
  ON public.product_questions (product_id, created_at)
  WHERE status = 'published';

-- The moderation queue.
CREATE INDEX IF NOT EXISTS product_questions_status_idx
  ON public.product_questions (status, created_at DESC);

-- Answered but never mailed — the retry set for the notification.
CREATE INDEX IF NOT EXISTS product_questions_unnotified_idx
  ON public.product_questions (answered_at)
  WHERE answer_notified_at IS NULL AND answered_at IS NOT NULL;

COMMENT ON TABLE public.product_questions IS
  'Pre-purchase questions and the shop''s public answers. Open to anyone (unlike product_reviews, which requires a verified purchase) and published only after moderation. Holds an email address, so anon has no grant of any kind.';

CREATE OR REPLACE FUNCTION public.touch_product_questions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS product_questions_touch_updated_at ON public.product_questions;
CREATE TRIGGER product_questions_touch_updated_at
  BEFORE UPDATE ON public.product_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_questions_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Lock it down
-- ---------------------------------------------------------------------------
-- The answers are public content; this table is not a public table. It holds
-- the asker's email address, the moderator's notes, and questions nobody has
-- vetted — including whatever a spammer submitted this morning. The storefront
-- reads it server-side through the service role and sends only the fields it
-- means to show.
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'product_questions'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.product_questions', r.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.product_questions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'table' AS item,
       'product_questions' AS name,
       count(*)::text || ' rows, ' ||
       count(*) FILTER (WHERE status = 'pending')::text || ' pending' AS detail
  FROM public.product_questions;
