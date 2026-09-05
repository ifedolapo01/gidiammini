/**
 * COMMERCE layer — reading a CSV that a person produced.
 *
 * `text.split('\n').map(line => line.split(','))` handles none of what real
 * files contain: a delivery address with a comma, a product description with a
 * newline inside a quoted cell, a name with a doubled quote, the byte-order
 * mark Excel writes, or the carriage returns Windows adds. Each of those turns
 * into silently shifted columns rather than an error, which is the worst way
 * for an import to fail — it succeeds, wrongly.
 *
 * So this is a proper RFC 4180 scan. Pure and dependency-free: the whole point
 * is that the parsing rules can be tested against the awkward cases without a
 * file picker.
 */

/** Rows of raw cells, exactly as written — no trimming, no type guessing.
 * Interpretation is product-import.ts's job. */
export function parseCsv(input: string): string[][] {
  // Excel writes a BOM; left in place it becomes part of the first header and
  // no column ever matches it.
  const text = input.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') {
        cell += char;
        continue;
      }

      // A doubled quote inside a quoted cell is one literal quote.
      if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\r' || char === '\n') {
      // CRLF is one line ending, not two.
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  // Whatever was still being read when the text ran out. Skipped only when the
  // file ended with a clean line break, which would otherwise add a phantom
  // row of one empty cell.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** True for a row that carries nothing — a blank line, or the trailing commas
 * a spreadsheet leaves behind under the last real row. */
export function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

/**
 * The header row and the data rows, with blanks dropped.
 *
 * `line` is the 1-based line number in the original file, kept so an error can
 * say "line 42" and mean the row the person can actually see in their editor —
 * not the index after blank lines were removed.
 */
export interface CsvTable {
  headers: string[];
  rows: Array<{ line: number; cells: string[] }>;
}

export function readCsvTable(input: string): CsvTable {
  const all = parseCsv(input);
  const headerIndex = all.findIndex((row) => !isBlankRow(row));

  if (headerIndex === -1) return { headers: [], rows: [] };

  return {
    headers: all[headerIndex].map((cell) => cell.trim()),
    rows: all
      .map((cells, index) => ({ line: index + 1, cells }))
      .filter(({ line, cells }) => line > headerIndex + 1 && !isBlankRow(cells)),
  };
}
