// app/api/admin/products/bulk/route.ts - one action applied to many products
// or variants in a single request.
//
// End-of-season markdown on 60 products was 60 form submissions; a stock count
// was one modal per variant. This is the same set of writes, batched, with a
// per-row result so a partial failure is visible instead of silent.
//
// The actions live in ../bulk-actions.ts and the batching in lib/api/bulk.ts,
// so this file is only validation and dispatch.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseBulkIds, runBulk, MAX_BULK_ROWS, type BulkRowHandler } from '@/lib/api/bulk';
import { isValidPercent } from '@/lib/commerce/price-adjust';
import {
  productNames,
  setProductActive,
  moveProductCategory,
  adjustProductPrice,
  setVariantStock,
} from '../bulk-actions';

export const maxDuration = 60;

const ACTIONS = ['activate', 'deactivate', 'category', 'price_adjust', 'stock_set'] as const;
type BulkAction = (typeof ACTIONS)[number];

function bad(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

/** "productId:variantKey" for stock_set, a plain product id otherwise. */
function productIdOf(rowId: string): string {
  const separator = rowId.indexOf(':');
  return separator < 1 ? rowId : rowId.slice(0, separator);
}

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json().catch(() => null);

  const action = body?.action as BulkAction | undefined;
  if (!action || !(ACTIONS as readonly string[]).includes(action)) {
    return bad(`Unknown action. Must be one of: ${ACTIONS.join(', ')}`);
  }

  const ids = parseBulkIds(body?.ids);
  if (!ids) return bad(`Select between 1 and ${MAX_BULK_ROWS} rows.`);

  const names = await productNames(supabase, ids.map(productIdOf));
  const labelFor = (id: string) => names.get(id) ?? id;

  let handle: BulkRowHandler;

  switch (action) {
    case 'activate':
    case 'deactivate': {
      const isActive = action === 'activate';
      handle = (id) => setProductActive(supabase, id, isActive, labelFor(id), audit);
      break;
    }

    case 'category': {
      const category = typeof body?.category === 'string' ? body.category.trim() : '';
      if (!category) return bad('Choose a category to move these products into.');
      const subCategory = typeof body?.subCategory === 'string' && body.subCategory.trim()
        ? body.subCategory.trim()
        : null;
      handle = (id) => moveProductCategory(supabase, id, category, subCategory, labelFor(id), audit);
      break;
    }

    case 'price_adjust': {
      const percent = typeof body?.percent === 'number' ? body.percent : Number(body?.percent);
      if (!isValidPercent(percent)) {
        return bad('Enter a percentage between -99 and 1000, and not zero.');
      }
      handle = (id) => adjustProductPrice(supabase, id, percent, labelFor(id), audit);
      break;
    }

    case 'stock_set': {
      const stock = Number.parseInt(String(body?.stock), 10);
      if (!Number.isFinite(stock) || stock < 0) {
        return bad('Stock must be a whole number of zero or more.');
      }
      handle = (rowId) => setVariantStock(supabase, rowId, stock, names, audit);
      break;
    }
  }

  const outcome = await runBulk(ids, handle);

  // 200 even with failures: the rows that succeeded are written, and re-running
  // the whole batch on a retry would re-apply a price cut to everything that
  // already took it.
  return NextResponse.json({ success: outcome.failed === 0, action, ...outcome });
});
