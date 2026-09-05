/**
 * COMMERCE layer — turning rows into a CSV a spreadsheet will open correctly.
 *
 * Three things this gets right that a `rows.map(r => r.join(',')).join('\n')`
 * does not, and each of them is a real bug rather than a nicety:
 *
 *   1. QUOTING. A delivery address contains commas, a customer note contains
 *      newlines, and a product name contains quotes. Any of the three silently
 *      shifts every later column into the wrong one.
 *
 *   2. FORMULA INJECTION. A cell beginning `=`, `+`, `-`, `@` or a control
 *      character is executed as a formula by Excel and Sheets. Customer names
 *      and notes are attacker-controlled text that ends up in a file the shop
 *      owner opens on their own machine, so every such cell is prefixed with an
 *      apostrophe — the standard defence, and invisible once opened.
 *
 *   3. ENCODING. Excel reads a UTF-8 file as the local codepage unless it
 *      begins with a byte-order mark, which turns ₦ and any accented name into
 *      mojibake. The BOM is prepended for that reason alone.
 *
 * Pure, so all of the above is testable without a database or a download.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** Characters that make a leading cell dangerous in a spreadsheet. */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function stringify(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** One CSV cell: injection-guarded, then quoted if it has to be. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = stringify(value);

  if (text.length > 0 && FORMULA_TRIGGERS.includes(text[0])) {
    text = `'${text}`;
  }

  // Leading/trailing spaces are quoted too — some readers strip them
  // otherwise, which silently edits the data.
  const mustQuote = /[",\r\n]/.test(text) || text !== text.trim();

  return mustQuote ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 line endings (CRLF) and a BOM, because the audience for these files
 * is Excel far more often than a script.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => csvCell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','));

  return `﻿${[header, ...body].join('\r\n')}\r\n`;
}

/** `orders-2026-09-05.csv` — dated, so successive exports do not overwrite
 * each other in the downloads folder. */
export function csvFilename(dataset: string, now: Date = new Date()): string {
  return `${dataset}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Headers rather than a Response: this is a Commerce-layer module and has no
 * business knowing which framework is serving it. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    // An export is a point-in-time snapshot; a cached one is a wrong one.
    'Cache-Control': 'no-store',
  };
}
