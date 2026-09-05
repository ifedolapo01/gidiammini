/**
 * COMMERCE layer — the contract every export dataset satisfies.
 *
 * Separate from the datasets themselves so a route can name the dataset list
 * without pulling in every query behind it.
 */
import type { CsvColumn } from './csv';

export const EXPORT_DATASETS = ['orders', 'products', 'stock', 'customers'] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export interface DatasetResult<T> {
  rows: T[];
  columns: CsvColumn<T>[];
  truncated: boolean;
}

export interface ExportRange {
  from?: string;
  to?: string;
}

/** Shared by the dataset builders: an absent value is an empty cell, never
 * the word "null". */
export const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

