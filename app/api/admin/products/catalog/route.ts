// app/api/admin/products/catalog/route.ts - every product, as thin as it can
// be, for the surfaces that genuinely need all of them at once.
//
// That is the discount editor: its target dropdown lists every product, and
// findBelowCostVariants() has to check the proposed discount against every
// variant it would touch. Neither question can be answered from one page.
//
// So the answer is a narrower projection rather than a page: no images, no
// description, no pricing_config, and only the variant columns the margin
// check reads. It is also not polled — the target list does not need to be
// live, and the discounts page loads it once.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const dynamic = 'force-dynamic';

/**
 * A ceiling rather than paging. A catalogue past this is one where the target
 * dropdown has stopped being a usable control anyway, and silently truncating
 * would make a discount look safe when unchecked products sit below cost — so
 * the response says when it happened.
 */
const MAX_CATALOG_ROWS = 2000;

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, category, sub_category, price, is_active,' +
      ' product_variants ( variant_key, size, color, price, cost, is_active )'
    )
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(MAX_CATALOG_ROWS);

  if (error) {
    console.error('Error loading product catalog:', error);
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
  });
});
