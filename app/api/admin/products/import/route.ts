// app/api/admin/products/import/route.ts - CSV catalogue import, in two modes.
//
// PREVIEW writes nothing. It parses the file, validates every row, and says
// which products would be created and which updated. That is the whole point:
// an import that only tells you what it did after it has done it is one nobody
// dares run on a real catalogue.
//
// COMMIT re-parses the same text server-side rather than trusting rows the
// browser sends back. The parse is pure, so the second pass sees exactly what
// the preview showed — and a client that tampered with the rows in between
// cannot write something the operator never saw.
//
// Writes go through the same buildProductCreatePayload / syncVariants /
// applyVariantCosts path the admin form uses. A second way to create a product
// is how the two drift into disagreeing about what pricing_config means.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth, type AuditRecorder } from '@/lib/api/with-admin-auth';
import { runBulk, type BulkRowResult } from '@/lib/api/bulk';
import { readCsvTable } from '@/lib/commerce/csv-parse';
import {
  parseProductRows,
  toProductPayload,
  DERIVED_FIELDS,
  type ColumnMapping,
  type ImportProduct,
} from '@/lib/commerce/product-import';
import { buildProductCreatePayload } from '@/lib/commerce/product-payload';
import { syncVariants, applyVariantCosts } from '../product-write';

export const maxDuration = 60;

/** Generous for a catalogue, small enough that a paste-bomb cannot tie up the
 * function. */
const MAX_CSV_BYTES = 2_000_000;

/** One request's worth of products. Beyond this the file wants splitting —
 * the alternative is a timeout halfway through, which is the worst outcome
 * for a half-written catalogue. */
const MAX_PRODUCTS = 500;

interface Resolved {
  product: ImportProduct;
  existingId: string | null;
}

/**
 * Which of these products already exist.
 *
 * By id when the file carries one (an export round-trip), otherwise by name,
 * case-insensitively — a person retyping "Cotton Romper" as "cotton romper"
 * means the same product, and creating a second one would be a silent
 * duplicate rather than an error.
 */
async function resolveExisting(
  supabase: SupabaseClient,
  products: ImportProduct[]
): Promise<Resolved[]> {
  const ids = products.map((p) => p.productId).filter((id): id is string => Boolean(id));
  const names = products.filter((p) => !p.productId).map((p) => p.name);

  const [byId, byName] = await Promise.all([
    ids.length
      ? supabase.from('products').select('id, name').in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    names.length
      ? supabase.from('products').select('id, name').in('name', names)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const existingIds = new Set((byId.data ?? []).map((row: any) => row.id));
  const idByName = new Map<string, string>(
    (byName.data ?? []).map((row: any) => [String(row.name).toLowerCase(), row.id])
  );

  return products.map((product) => ({
    product,
    existingId: product.productId
      ? (existingIds.has(product.productId) ? product.productId : null)
      : (idByName.get(product.name.toLowerCase()) ?? null),
  }));
}

async function writeProduct(
  supabase: SupabaseClient,
  resolved: Resolved,
  provided: string[],
  audit: AuditRecorder
): Promise<{ ok: boolean; label: string; error?: string }> {
  const { product, existingId } = resolved;
  const payload = toProductPayload(product);
  const label = product.name;

  if (existingId) {
    // Only what the file actually spoke about. Anything it had no column for
    // keeps the value it already had.
    const writable = new Set<string>([...DERIVED_FIELDS, ...provided]);
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [key, value] of Object.entries(payload)) {
      if (key !== 'variant_costs' && writable.has(key)) update[key] = value;
    }

    const { error } = await supabase.from('products').update(update).eq('id', existingId);
    if (error) return { ok: false, label, error: error.message };

    await syncVariants(supabase, existingId);
    await applyVariantCosts(supabase, existingId, payload.variant_costs);

    audit({
      entityType: 'product',
      entityId: existingId,
      action: 'update',
      after: { name: payload.name, price: payload.price, stock: payload.stock },
      reason: 'CSV import',
    });

    return { ok: true, label };
  }

  const { variant_costs: costs, ...rest } = payload;
  const { data, error } = await supabase
    .from('products')
    .insert([buildProductCreatePayload(rest)])
    .select('id')
    .single();

  if (error) return { ok: false, label, error: error.message };

  await syncVariants(supabase, data.id);
  await applyVariantCosts(supabase, data.id, costs);

  audit({
    entityType: 'product',
    entityId: data.id,
    action: 'create',
    after: { name: payload.name, price: payload.price, stock: payload.stock },
    reason: 'CSV import',
  });

  return { ok: true, label };
}

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json().catch(() => null);

  const csv = typeof body?.csv === 'string' ? body.csv : '';
  const mapping = (body?.mapping ?? {}) as ColumnMapping;
  const commit = body?.mode === 'commit';

  if (!csv.trim()) {
    return NextResponse.json({ success: false, error: 'No CSV content received.' }, { status: 400 });
  }

  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { success: false, error: 'That file is too large. Split it into smaller batches.' },
      { status: 413 }
    );
  }

  const table = readCsvTable(csv);
  if (table.headers.length === 0) {
    return NextResponse.json(
      { success: false, error: 'That file has no header row.' },
      { status: 400 }
    );
  }

  const { products, issues, provided } = parseProductRows(table.rows, mapping);

  if (products.length > MAX_PRODUCTS) {
    return NextResponse.json(
      {
        success: false,
        error: `That file holds ${products.length} products. Import at most ${MAX_PRODUCTS} at a time.`,
      },
      { status: 413 }
    );
  }

  const resolved = await resolveExisting(supabase, products);
  const creates = resolved.filter((r) => !r.existingId).length;

  const plan = resolved.map((r) => ({
    name: r.product.name,
    action: r.existingId ? ('update' as const) : ('create' as const),
    variants: r.product.variants.length,
    lines: r.product.lines,
  }));

  const summary = {
    products: products.length,
    creates,
    updates: products.length - creates,
    rowsWithProblems: issues.length,
  };

  if (!commit) {
    return NextResponse.json({ success: true, mode: 'preview', summary, plan, issues });
  }

  // A file with problems is refused wholesale rather than half-applied. The
  // operator has already been shown exactly which lines, so "fix them and
  // re-run" is a clear instruction; a partial catalogue is not.
  if (issues.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Fix the reported rows before importing.',
        summary,
        issues,
      },
      { status: 400 }
    );
  }

  const byKey = new Map(resolved.map((r) => [r.product.key, r]));
  const outcome = await runBulk([...byKey.keys()], async (key) => {
    const entry = byKey.get(key);
    if (!entry) return { ok: false, error: 'Product vanished between preview and import.' };
    return writeProduct(supabase, entry, provided, audit);
  });

  return NextResponse.json({
    success: outcome.failed === 0,
    mode: 'commit',
    summary,
    ...outcome,
    results: outcome.results as BulkRowResult[],
  });
});
