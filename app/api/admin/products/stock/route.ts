// app/api/admin/products/stock/route.ts - the admin stock table's list, one
// page at a time.
//
// Shares lib/commerce/admin-products-query.ts with the products list: the two
// tables render the same grouped rows and differ only in default sort (lowest
// stock first here) and which columns they show. It previously selected every
// active product with every variant embedded, unpaginated, on a 60-second
// poll.
//
// Goes through withAdminAuth rather than checking the cookie itself, so it
// picks up the shared service-role client and error shape like every other
// admin route.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { fetchAdminProducts } from '@/lib/commerce/admin-products-query';

export const dynamic = 'force-dynamic';

export const GET = withAdminAuth(async (request, { supabase }) => {
  try {
    const { products, meta } = await fetchAdminProducts(supabase, new URL(request.url), {
      defaultSort: 'stock',
      defaultDirection: 'asc',
    });

    return NextResponse.json({ success: true, products, meta });
  } catch (error: any) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock data', products: [] },
      { status: 500 }
    );
  }
});
