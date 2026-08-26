-- ============================================================================
-- Take payment receipts off the public internet
-- ----------------------------------------------------------------------------
-- Verified before writing this: every receipt_url stored on an order returned
-- HTTP 200 image/png when fetched with no credentials. Bank transfer
-- screenshots contain account names, account numbers, balances and transaction
-- references, so those URLs are other people's financial data.
--
-- After lock-down-rls.sql the URLs are no longer discoverable through the
-- orders table, but the objects themselves are still world-readable to anyone
-- who has or guesses a URL — and the old naming scheme,
-- {orderNumber}-{timestamp}.jpg where the order number is "UT" plus a
-- truncated timestamp, is guessable.
--
-- This migration:
--   1. makes the receipts bucket private
--   2. removes anon's storage access to it (uploads now go through the server)
--   3. replaces orders.receipt_url with orders.receipt_path
--
-- On (3): the column is renamed rather than repurposed on purpose. A field
-- still called *_url that must never be used as a URL is exactly the trap that
-- produced this bug — someone writes <img src={order.receipt_url}> again. The
-- old column is kept but blanked, so any missed reference renders nothing
-- instead of leaking, and no data is lost (the path is preserved).
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Private bucket
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET public = false
 WHERE id = 'receipts';

-- ---------------------------------------------------------------------------
-- 2. Remove anon/authenticated storage policies for the receipts bucket
-- ---------------------------------------------------------------------------
-- The browser used to upload here with the anon key, which required an INSERT
-- policy. Uploads now go through /api/checkout/receipt on the service-role
-- client, so no client-facing policy is needed at all. Only policies that
-- actually mention this bucket are touched — product_images is left alone.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND (COALESCE(qual, '') LIKE '%receipts%' OR COALESCE(with_check, '') LIKE '%receipts%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    RAISE NOTICE 'Dropped storage policy "%" (referenced the receipts bucket)', r.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Store the object path, not a URL
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- Backfill from the legacy absolute URLs, e.g.
--   https://<ref>.supabase.co/storage/v1/object/public/receipts/UT123-456.jpg
--                                                             ^^^^^^^^^^^^^^ this part
UPDATE public.orders
   SET receipt_path = split_part(receipt_url, '/object/public/receipts/', 2)
 WHERE receipt_path IS NULL
   AND receipt_url IS NOT NULL
   AND receipt_url LIKE '%/object/public/receipts/%';

-- Any row whose receipt_url wasn't in that shape (already a bare path, say)
-- carries over as-is rather than being silently dropped.
UPDATE public.orders
   SET receipt_path = receipt_url
 WHERE receipt_path IS NULL
   AND receipt_url IS NOT NULL
   AND receipt_url NOT LIKE 'http%';

-- Blank the old column so a stray <img src={order.receipt_url}> can't leak, and
-- so it's obvious the value moved rather than being duplicated.
UPDATE public.orders
   SET receipt_url = NULL
 WHERE receipt_url IS NOT NULL
   AND receipt_path IS NOT NULL;

COMMENT ON COLUMN public.orders.receipt_url IS
  'DEPRECATED, always NULL. Receipts moved to receipt_path (a private storage object path) in scripts/private-receipts.sql. Safe to drop once no deployment references it.';
COMMENT ON COLUMN public.orders.receipt_path IS
  'Object path inside the private "receipts" storage bucket. Never a URL. Render it via a short-lived signed URL from the admin-only receipt endpoint.';

-- ---------------------------------------------------------------------------
-- 4. Report the resulting state
-- ---------------------------------------------------------------------------
SELECT 'bucket'                                     AS item,
       id                                           AS name,
       CASE WHEN public THEN 'PUBLIC' ELSE 'private' END AS detail
  FROM storage.buckets

UNION ALL
SELECT 'storage policy', policyname, 'on storage.objects'
  FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'

UNION ALL
SELECT 'order receipt',
       order_number,
       COALESCE('path=' || receipt_path, 'no receipt')
         || CASE WHEN receipt_url IS NOT NULL THEN '  (legacy receipt_url STILL SET)' ELSE '' END
  FROM public.orders
 ORDER BY item, name;
