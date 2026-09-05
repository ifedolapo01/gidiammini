/**
 * COMMERCE layer — turning CSV rows into products, and saying exactly what is
 * wrong with the ones that cannot be.
 *
 * ONE ROW PER VARIANT, grouped by product. That is deliberately the same shape
 * the products export writes, so the round trip works: export the catalogue,
 * edit it in a spreadsheet, import it back. A format you can only write by hand
 * is a format nobody uses twice.
 *
 * Everything here is pure. The dry run the admin sees before committing is
 * this function and nothing else — no database, no writes — which is what makes
 * "show me what this file would do" honest rather than a guess.
 *
 * The field list lives in product-import-fields.ts and the write payload in
 * product-import-payload.ts; both are re-exported here so a caller needs one
 * import for the whole importer.
 */
import { providedFields, type ColumnMapping } from './product-import-fields';
import { validateProduct } from './product-import-validate';

export {
  IMPORT_FIELDS,
  autoMapColumns,
  providedFields,
  DERIVED_FIELDS,
  type ImportField,
  type ColumnMapping,
} from './product-import-fields';

export { toProductPayload, type ProductWritePayload } from './product-import-payload';

export interface ImportIssue {
  /** Line number in the original file, so it matches what the person sees. */
  line: number;
  field?: string;
  message: string;
}

export interface ImportVariantRow {
  line: number;
  size: string;
  color: string;
  price: number;
  stock: number;
  cost: number | null;
  sku: string;
}

export interface ImportProduct {
  /** Lower-cased name, or the product id when one was given. */
  key: string;
  name: string;
  productId: string | null;
  category: string;
  subCategory: string | null;
  description: string;
  mainImage: string;
  variants: ImportVariantRow[];
  lines: number[];
}

export interface ParsedImport {
  products: ImportProduct[];
  issues: ImportIssue[];
  /** Field keys the file actually supplied a column for. An update must write
   * only these, plus the derived ones below — otherwise importing a sheet with
   * no description column silently clears every description, which is the
   * exact data loss lib/commerce/product-payload.ts exists to prevent. */
  provided: string[];
}

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function cellAt(cells: string[], index: number | null | undefined): string {
  return typeof index === 'number' ? (cells[index] ?? '').trim() : '';
}

/** Money and counts arrive as whatever a spreadsheet exported — "₦1,500.00",
 * "1 500", "1500". Everything that is not a digit, a dot or a minus goes. */
function parseNumber(raw: string): number | null {
  if (raw === '') return null;
  const cleaned = raw.replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseProductRows(
  rows: Array<{ line: number; cells: string[] }>,
  mapping: ColumnMapping
): ParsedImport {
  const issues: ImportIssue[] = [];
  const byKey = new Map<string, ImportProduct>();

  for (const { line, cells } of rows) {
    const name = cellAt(cells, mapping.name).slice(0, MAX_NAME);
    const productId = cellAt(cells, mapping.product_id) || null;

    if (!name) {
      issues.push({ line, field: 'name', message: 'Product name is required.' });
      continue;
    }

    const rawPrice = cellAt(cells, mapping.price);
    const price = parseNumber(rawPrice);

    if (price === null) {
      issues.push({ line, field: 'price', message: `Price is required — "${rawPrice}" is not a number.` });
      continue;
    }
    if (price < 0) {
      issues.push({ line, field: 'price', message: 'Price cannot be negative.' });
      continue;
    }

    const rawStock = cellAt(cells, mapping.stock);
    const parsedStock = rawStock === '' ? 0 : parseNumber(rawStock);

    if (parsedStock === null) {
      issues.push({ line, field: 'stock', message: `"${rawStock}" is not a number.` });
      continue;
    }
    if (parsedStock < 0) {
      issues.push({ line, field: 'stock', message: 'Stock cannot be negative.' });
      continue;
    }

    const rawCost = cellAt(cells, mapping.cost);
    const parsedCost = rawCost === '' ? null : parseNumber(rawCost);

    if (rawCost !== '' && (parsedCost === null || parsedCost < 0)) {
      issues.push({ line, field: 'cost', message: `"${rawCost}" is not a valid cost.` });
      continue;
    }

    // Grouping on the id when there is one means a renamed product still
    // updates in place rather than creating a second copy.
    const key = (productId || name).toLowerCase();
    let product = byKey.get(key);

    if (!product) {
      product = {
        key,
        name,
        productId,
        category: cellAt(cells, mapping.category) || 'babies',
        subCategory: cellAt(cells, mapping.sub_category) || null,
        description: cellAt(cells, mapping.description).slice(0, MAX_DESCRIPTION),
        mainImage: cellAt(cells, mapping.main_image),
        variants: [],
        lines: [],
      };
      byKey.set(key, product);
    }

    // Later rows fill in what the first row of a product left blank, so
    // repeating the description on every line is optional rather than required.
    product.mainImage ||= cellAt(cells, mapping.main_image);
    product.description ||= cellAt(cells, mapping.description).slice(0, MAX_DESCRIPTION);

    product.variants.push({
      line,
      size: cellAt(cells, mapping.size),
      color: cellAt(cells, mapping.color),
      price: Math.round(price),
      stock: Math.trunc(parsedStock),
      cost: parsedCost === null ? null : Math.round(parsedCost),
      sku: cellAt(cells, mapping.sku),
    });
    product.lines.push(line);
  }

  for (const product of byKey.values()) {
    issues.push(...validateProduct(product));
  }

  return { products: [...byKey.values()], issues, provided: providedFields(mapping) };
}
