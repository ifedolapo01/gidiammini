-- ============================================================================
-- Make order search find a phone number however it was typed
-- ----------------------------------------------------------------------------
-- orders.customer_phone holds exactly what the customer entered at checkout —
-- "0809 653 9067", "+234 809 653 9067", "08096539067" are all in there. The
-- admin search does an ILIKE against that column, so searching "0809 653"
-- finds the first and misses the other two, and searching the number off a
-- delivery note finds nothing at all. The operator concludes the order does
-- not exist.
--
-- A generated column holds the same number with the formatting and the country
-- prefix removed, so every way of writing it collapses to one form that can be
-- matched against a search term normalised the same way in TypeScript (see
-- lib/commerce/phone-search.ts).
--
-- Both functions used are IMMUTABLE, which a generated column requires:
-- COALESCE is, and so is the three-argument regexp_replace. The alternation is
-- ordered longest-first because POSIX regexes prefer the longest match, so
-- "00234..." loses its whole prefix rather than just the leading zero.
--
-- NO INDEX, deliberately. The search is a contains match, which a btree cannot
-- serve, and a GIN trigram index would mean taking a dependency on pg_trgm for
-- a table with a few thousand rows. When orders reach five figures, add:
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX orders_phone_digits_trgm_idx
--     ON public.orders USING gin (customer_phone_digits gin_trgm_ops);
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone_digits text
  GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g'),
      '^(00234|234|0)',
      ''
    )
  ) STORED;

COMMENT ON COLUMN public.orders.customer_phone_digits IS
  'customer_phone with punctuation and any Nigerian country/trunk prefix stripped, so admin search matches a number whatever format it was typed in. Generated; never written directly.';
