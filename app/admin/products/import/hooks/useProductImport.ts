/** ADMIN layer — the state behind the CSV import wizard.
 *
 * Four steps, and the third is the one that matters: nothing is written until
 * the operator has seen a dry run naming every product that would be created,
 * every one that would be updated, and every row that cannot be read. Import
 * tools that skip that step are the ones people are afraid to run twice.
 *
 * The file is parsed here only to populate the mapping dropdowns and the
 * preview table. The server re-parses the same text for both the dry run and
 * the commit, so what it writes can never differ from what it showed.
 */
'use client';

import { useCallback, useState } from 'react';
import { readCsvTable } from '@/lib/commerce/csv-parse';
import { autoMapColumns, type ColumnMapping, type ImportIssue } from '@/lib/commerce/product-import';

export type ImportStep = 'file' | 'map' | 'preview' | 'done';

export interface ImportPlanEntry {
  name: string;
  action: 'create' | 'update';
  variants: number;
  lines: number[];
}

export interface ImportSummary {
  products: number;
  creates: number;
  updates: number;
  rowsWithProblems: number;
}

export interface CommitResult {
  succeeded: number;
  failed: number;
  results: Array<{ id: string; ok: boolean; label?: string; error?: string }>;
}

const ENDPOINT = '/api/admin/products/import';

export function useProductImport() {
  const [step, setStep] = useState<ImportStep>('file');
  const [filename, setFilename] = useState('');
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [plan, setPlan] = useState<ImportPlanEntry[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep('file');
    setFilename('');
    setCsv('');
    setHeaders([]);
    setRowCount(0);
    setMapping({});
    setSummary(null);
    setPlan([]);
    setIssues([]);
    setResult(null);
    setError('');
  }, []);

  const loadFile = useCallback(async (file: File) => {
    setError('');

    try {
      const text = await file.text();
      const table = readCsvTable(text);

      if (table.headers.length === 0) {
        setError('That file has no header row.');
        return;
      }
      if (table.rows.length === 0) {
        setError('That file has a header but no rows.');
        return;
      }

      setFilename(file.name);
      setCsv(text);
      setHeaders(table.headers);
      setRowCount(table.rows.length);
      // Guessed, then shown for confirmation — the common case is a file this
      // admin exported, where every column already matches.
      setMapping(autoMapColumns(table.headers));
      setStep('map');
    } catch (caught: any) {
      console.error('Could not read the CSV:', caught);
      setError('Could not read that file.');
    }
  }, []);

  const setColumn = useCallback((field: string, index: number | null) => {
    setMapping((current) => ({ ...current, [field]: index }));
  }, []);

  const send = useCallback(
    async (mode: 'preview' | 'commit') => {
      setBusy(true);
      setError('');

      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, csv, mapping }),
        });

        const payload = await response.json().catch(() => null);

        if (payload?.summary) setSummary(payload.summary);
        if (Array.isArray(payload?.issues)) setIssues(payload.issues);

        if (!response.ok || !payload?.success) {
          setError(payload?.error || `Request failed (${response.status})`);
          // A refused commit still carries the row problems that caused it, so
          // stay on the preview where they are listed.
          if (mode === 'commit') setStep('preview');
          return;
        }

        if (mode === 'preview') {
          setPlan(payload.plan ?? []);
          setStep('preview');
        } else {
          setResult({
            succeeded: payload.succeeded ?? 0,
            failed: payload.failed ?? 0,
            results: payload.results ?? [],
          });
          setStep('done');
        }
      } catch (caught: any) {
        console.error(`Import ${mode} failed:`, caught);
        setError(caught.message || 'Could not reach the server.');
      } finally {
        setBusy(false);
      }
    },
    [csv, mapping]
  );

  return {
    step,
    setStep,
    filename,
    headers,
    rowCount,
    mapping,
    setColumn,
    summary,
    plan,
    issues,
    result,
    busy,
    error,
    loadFile,
    runPreview: useCallback(() => send('preview'), [send]),
    commit: useCallback(() => send('commit'), [send]),
    reset,
  };
}
