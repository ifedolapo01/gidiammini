// app/api/admin/counter-sales/products/route.ts - the catalogue behind the
// counter-sale product picker.
//
// A cashier-safe sibling of /api/admin/products/catalog, which the order-edit
// picker uses: same shape, minus product_variants.cost. A cashier's only
// permission is counter_sale:write, and margin data has no business reaching
// a screen whose entire job is "search a product, add it, take payment".
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { loadPublicStoreSettings } from '@/lib/commerce/store-settings-server';

export const dynamic = 'force-dynamic';

const MAX_CATALOG_ROWS = 2000;

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, category, price, is_active,' +
        ' product_variants ( variant_key, size, color, price, is_active )'
      )
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(MAX_CATALOG_ROWS),
    // The same publicly-readable tax rate the storefront prices with — a
    // cashier has no store:read (so cannot read /api/admin/settings), and this
    // screen's own live preview needs the rate from somewhere.
    loadPublicStoreSettings(),
  ]);

  if (error) {
    console.error('Error loading counter-sale catalog:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load products', products: [] },
      { status: 500 }
    );
  }

  const products = data ?? [];

  return NextResponse.json({
    success: true,
    products,
    truncated: products.length === MAX_CATALOG_ROWS,
    tax_rate: settings.taxRate,
  });
});
