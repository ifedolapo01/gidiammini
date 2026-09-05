/**
 * COMMERCE layer — which columns an import understands, and guessing them from
 * a file's header row.
 *
 * Split from the row parsing so the mapping UI can import the field list
 * without pulling in the validation, and so "what can a CSV contain" is one
 * short file rather than a section of a long one.
 */

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

/** The columns an import understands, in the order the mapping step shows
 * them. Header names in the file need not match — that is what mapping is
 * for — but matching ones are detected automatically. */
export const IMPORT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Product name', required: true, hint: 'Rows sharing a name become one product' },
  { key: 'product_id', label: 'Product ID', hint: 'From an export. Present means update that exact product' },
  { key: 'category', label: 'Category' },
  { key: 'sub_category', label: 'Sub-category' },
  { key: 'description', label: 'Description' },
  { key: 'size', label: 'Size' },
  { key: 'color', label: 'Colour' },
  { key: 'price', label: 'Price', required: true },
  { key: 'stock', label: 'Stock' },
  { key: 'cost', label: 'Cost price' },
  { key: 'sku', label: 'SKU' },
  { key: 'main_image', label: 'Main image URL' },
];

/** Field key -> column index in the file, or null for "not provided". */
export type ColumnMapping = Record<string, number | null>;

/** Extra header spellings worth recognising beyond the field key itself. */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['product', 'product name', 'title', 'item'],
  product_id: ['id', 'product id'],
  sub_category: ['subcategory', 'sub category'],
  color: ['colour', 'variant colour', 'variant color'],
  size: ['variant size'],
  price: ['unit price', 'selling price', 'amount'],
  stock: ['quantity', 'qty', 'stock level', 'inventory'],
  cost: ['cost price', 'buy price', 'unit cost'],
  main_image: ['image', 'image url', 'photo'],
};

const normaliseHeader = (header: string) => header.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

/** Best guess at which column is which, so the common case is confirm-and-go
 * rather than twelve dropdowns. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalised = headers.map(normaliseHeader);
  const mapping: ColumnMapping = {};

  for (const field of IMPORT_FIELDS) {
    const candidates = [normaliseHeader(field.key), ...(HEADER_ALIASES[field.key] ?? [])];
    const index = normalised.findIndex((header) => candidates.includes(header));
    mapping[field.key] = index === -1 ? null : index;
  }

  return mapping;
}

/** Always written on an update, because they are derived from the variant
 * rows rather than read from a single column. */
export const DERIVED_FIELDS = ['price', 'stock', 'pricing_config', 'sizes', 'colors'] as const;

/** The columns a file supplied, ignoring the ones that only identify a row. */
export function providedFields(mapping: ColumnMapping): string[] {
  const identifying = new Set(['product_id', 'size', 'color', 'price', 'stock', 'cost', 'sku']);
  return IMPORT_FIELDS
    .map((field) => field.key)
    .filter((key) => !identifying.has(key) && typeof mapping[key] === 'number');
}
