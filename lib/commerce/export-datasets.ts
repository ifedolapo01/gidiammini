/**
 * COMMERCE layer — which export means which query.
 *
 * The datasets live in export-orders.ts and export-catalog.ts; this is only the
 * mapping from a URL segment to one of them, kept separate so "what can be
 * exported" is answerable at a glance.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ordersDataset } from './export-orders';
import { productsDataset, stockDataset, customersDataset } from './export-catalog';
import type { DatasetResult, ExportDataset, ExportRange } from './export-types';

export {
  EXPORT_DATASETS,
  type ExportDataset,
  type ExportRange,
  type DatasetResult,
} from './export-types';

export function buildDataset(
  supabase: SupabaseClient,
  dataset: ExportDataset,
  range: ExportRange = {}
): Promise<DatasetResult<any>> {
  switch (dataset) {
    case 'orders': return ordersDataset(supabase, range);
    case 'products': return productsDataset(supabase);
    case 'stock': return stockDataset(supabase);
    case 'customers': return customersDataset(supabase);
  }
}
