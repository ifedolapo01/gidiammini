/**
 * COMMERCE layer — the import problems only visible once a product's rows are
 * seen together.
 *
 * Per-cell checks (is this a number, is it negative) happen while parsing.
 * These are the ones that need the whole group: a product whose rows disagree
 * about having a size has no single pricing mode, and there is no honest way to
 * store it — refusing it beats guessing and silently dropping half the
 * variants.
 */
import type { ImportIssue, ImportProduct } from './product-import';

/** Problems only visible once a product's rows are seen together. */
export function validateProduct(product: ImportProduct): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const firstLine = product.lines[0];

  const withSize = product.variants.filter((v) => v.size !== '').length;
  const withColor = product.variants.filter((v) => v.color !== '').length;

  // A product where some rows name a size and others do not has no single
  // pricing mode, so there is no honest way to store it. Better to refuse it
  // than to guess and silently drop half the variants.
  if (withSize > 0 && withSize < product.variants.length) {
    issues.push({
      line: firstLine,
      field: 'size',
      message: `"${product.name}": some rows have a size and others do not. Give every row a size, or none.`,
    });
  }

  if (withColor > 0 && withColor < product.variants.length) {
    issues.push({
      line: firstLine,
      field: 'color',
      message: `"${product.name}": some rows have a colour and others do not. Give every row a colour, or none.`,
    });
  }

  const seen = new Set<string>();
  for (const variant of product.variants) {
    const key = `${variant.size}|${variant.color}`;
    if (seen.has(key)) {
      issues.push({
        line: variant.line,
        message: `"${product.name}" repeats the same size and colour. Each combination may appear once.`,
      });
    }
    seen.add(key);
  }

  if (product.variants.length > 1 && withSize === 0 && withColor === 0) {
    issues.push({
      line: firstLine,
      message: `"${product.name}" has ${product.variants.length} rows but no size or colour to tell them apart.`,
    });
  }

  return issues;
}

