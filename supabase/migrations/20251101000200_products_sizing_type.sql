-- Run this in the Supabase SQL Editor to add the sizing_type column

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizing_type TEXT DEFAULT 'size' CHECK (sizing_type IN ('size', 'age'));
