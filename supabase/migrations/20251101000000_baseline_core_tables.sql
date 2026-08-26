-- ============================================================================
-- BASELINE — products, orders, order_items
-- ----------------------------------------------------------------------------
-- These three tables were created by hand in the Supabase dashboard, so no DDL
-- for them existed anywhere in this repository even though eight later
-- migrations ALTER or REFERENCE them. This file closes that gap: it is the
-- definition read back out of the live database with
-- scripts/diagnostics/dump-core-table-ddl.sql.
--
-- It describes the tables as they were BEFORE the later migrations ran, so the
-- columns those migrations add are deliberately absent:
--
--   products : sub_category, pricing_config      (000100)
--              sizing_type                       (000200)
--   orders   : shipping_zone_id                  (000600)
--              selected_lga, selected_place      (000700)
--              payment_reminder_sent_at          (001300)
--              stock_reserved, reserved_until    (001500)
--              receipt_path                      (001800)
--
-- Two more objects are left to their own migrations, because each depends on
-- something that does not exist yet at this point in the sequence:
--   * orders_reservation_sweep_idx   -> 001500 (indexes reserved_until, and is
--                                      partial on stock_reserved)
--   * prevent_negative_stock trigger -> 001900 (calls a function defined
--                                      in 001600)
--
-- receipt_url is kept because it was part of the original table. It is
-- deprecated and always NULL from 001800 onward — see that migration.
-- ============================================================================

-- The id defaults use uuid_generate_v4() (uuid-ossp), not pgcrypto's
-- gen_random_uuid(). Hosted Supabase already enables this in the `extensions`
-- schema, so this line is a no-op there; a fresh database needs it.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    price integer NOT NULL,
    category text NOT NULL,
    main_image text NOT NULL,
    images text[] DEFAULT '{}'::text[],
    colors text[] DEFAULT '{}'::text[],
    sizes text[] DEFAULT '{}'::text[],
    stock integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    details text[] DEFAULT '{}'::text[],
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products USING btree (is_active);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    order_number text NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    total_amount integer NOT NULL,
    status text DEFAULT 'pending'::text,
    delivery_option text NOT NULL,
    selected_state text NOT NULL,
    delivery_address text,
    city text,
    note text,
    payment_verified boolean DEFAULT false,
    receipt_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT orders_order_number_key UNIQUE (order_number),
    CONSTRAINT orders_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    order_id uuid,
    product_id uuid,
    product_name text NOT NULL,
    price integer NOT NULL,
    quantity integer NOT NULL,
    size text,
    color text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT order_items_pkey PRIMARY KEY (id),
    CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
