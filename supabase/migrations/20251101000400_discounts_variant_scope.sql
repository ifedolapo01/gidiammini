-- Run this in your Supabase SQL Editor to fix the constraint error

-- 1. Drop the old constraint that doesn't know about VARIANT
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_scope_check;

-- 2. Add the new constraint that includes VARIANT
ALTER TABLE public.discounts ADD CONSTRAINT discounts_scope_check 
CHECK (scope IN ('SITEWIDE', 'CATEGORY', 'SUBCATEGORY', 'PRODUCT', 'VARIANT'));
