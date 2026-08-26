-- Run this in your Supabase SQL Editor

-- Add a JSONB column to track which email phases have been sent
ALTER TABLE public.discounts 
ADD COLUMN IF NOT EXISTS notified_phases JSONB DEFAULT '[]'::jsonb;
