-- SQL Setup Script for Categories, Subcategories, and Discounts

-- 1. Create Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Subcategories table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_slug TEXT NOT NULL REFERENCES public.categories(slug) ON DELETE CASCADE ON UPDATE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Discounts table
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED')),
    value INTEGER NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('SITEWIDE', 'CATEGORY', 'SUBCATEGORY', 'PRODUCT')),
    target_id TEXT, -- Can hold category slug, subcategory slug, or product ID depending on scope
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add sub_category and pricing_config to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_config JSONB;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- 6. Setup RLS Policies for public read access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on categories') THEN
        CREATE POLICY "Allow public read access on categories" ON public.categories FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on subcategories') THEN
        CREATE POLICY "Allow public read access on subcategories" ON public.subcategories FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on active discounts') THEN
        CREATE POLICY "Allow public read access on active discounts" ON public.discounts FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- 7. Insert Default Categories (Preserving existing structure)
INSERT INTO public.categories (name, slug, color) 
VALUES
('Babies', 'babies', 'from-amber-300/80 to-orange-400/90'),
('Kids & Pre-Teens', 'kids', 'from-sky-300/80 to-indigo-400/90'),
('Maternity', 'maternity', 'from-pink-300/80 to-purple-400/90')
ON CONFLICT (slug) DO NOTHING;

-- 8. Insert Default Subcategories
INSERT INTO public.subcategories (category_slug, name, slug)
VALUES
('babies', 'Tops', 'babies-tops'),
('babies', 'Pants', 'babies-pants'),
('babies', 'Shoes', 'babies-shoes'),
('kids', 'Tops', 'kids-tops'),
('kids', 'Pants', 'kids-pants'),
('kids', 'Shoes', 'kids-shoes'),
('maternity', 'Dresses', 'maternity-dresses'),
('maternity', 'Tops', 'maternity-tops'),
('maternity', 'Pants', 'maternity-pants'),
('maternity', 'Underwear', 'maternity-underwear')
ON CONFLICT (slug) DO NOTHING;
