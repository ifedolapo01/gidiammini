-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (so checkout form works)
CREATE POLICY "Allow public inserts to subscribers" ON public.subscribers
    FOR INSERT WITH CHECK (true);

-- Create policy to allow authenticated users (admin) to view/manage subscribers
CREATE POLICY "Allow authenticated full access to subscribers" ON public.subscribers
    FOR ALL USING (auth.role() = 'authenticated');
