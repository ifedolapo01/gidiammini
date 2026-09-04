-- ============================================================================
-- The storefront's name for a category.
--
-- The navigation, the footer and the product cards used to hardcode the three
-- categories and a 'kids' -> 'Kids & Pre-teens' special case, so adding a
-- category in the admin changed nothing a shopper could see. They now read
-- this table instead, which means the label a shopper reads has to be editable
-- without a code change.
--
-- Why not just use `name`: `name` is UNIQUE and is what the admin lists,
-- sorts and searches by. `display_name` is free text with no constraint but a
-- length cap — an admin can rename "Kids & Pre-Teens" to "Big Kids" for the
-- storefront without touching a value the admin UI identifies rows by, and
-- without touching `slug`, which products and discounts reference.
--
-- NULL means "use name", so every existing category keeps the label it has.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS display_name TEXT;

DO $$
BEGIN
  ALTER TABLE public.categories
    ADD CONSTRAINT categories_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) <= 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.categories.display_name IS
  'The label the storefront shows for this category (navigation, footer, product cards). NULL falls back to name. Edited in the admin.';

-- The one label the code used to override: the seeded name is
-- "Kids & Pre-Teens", while every storefront surface rendered
-- "Kids & Pre-teens". Written here so removing the hardcode changes nothing
-- a shopper sees.
UPDATE public.categories
   SET display_name = 'Kids & Pre-teens'
 WHERE slug = 'kids'
   AND display_name IS NULL
   AND name <> 'Kids & Pre-teens';
