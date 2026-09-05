/** ADMIN layer — CSV catalogue import.
 *
 * Four steps, and the wizard exists for the third one: nothing reaches the
 * database until a dry run has named every product that would be created, every
 * one that would be updated, and every row that cannot be read. Onboarding a
 * 200-item catalogue was days of typing before this; the reason to make it a
 * wizard rather than a single upload button is that a bulk write nobody
 * previewed is a bulk write nobody trusts.
 */
'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useProductImport } from './hooks/useProductImport';
import { ImportFilePicker } from './components/ImportFilePicker';
import { ImportColumnMapper } from './components/ImportColumnMapper';
import { ImportPreview } from './components/ImportPreview';
import { IMPORT_FIELDS } from '@/lib/commerce/product-import';

const STEPS = [
  { key: 'file', label: 'Choose file' },
  { key: 'map', label: 'Match columns' },
  { key: 'preview', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export default function ProductImportPage() {
  const wizard = useProductImport();
  const currentStep = STEPS.findIndex((step) => step.key === wizard.step);

  const mappingComplete = IMPORT_FIELDS.filter((field) => field.required).every(
    (field) => typeof wizard.mapping[field.key] === 'number'
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-2 text-body-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to products
      </Link>

      <h1 className="text-h4 font-bold text-text-primary">Import products</h1>
      <p className="mt-1 text-text-secondary">
        Bring in a catalogue from a spreadsheet. Nothing is saved until you have seen what it would
        change.
      </p>

      <ol className="my-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Import steps">
        {STEPS.map((step, index) => (
          <li
            key={step.key}
            aria-current={index === currentStep ? 'step' : undefined}
            className={`flex items-center gap-2 text-body-sm ${
              index === currentStep
                ? 'font-semibold text-primary'
                : index < currentStep
                ? 'text-text-secondary'
                : 'text-text-muted'
            }`}
          >
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-caption-md ${
                index <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary'
              }`}
            >
              {index + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>

      {wizard.error && (
        <div role="alert" className="mb-6 rounded-control border border-destructive-border bg-destructive-background p-4">
          <p className="font-medium text-destructive">{wizard.error}</p>
        </div>
      )}

      {wizard.step === 'file' && <ImportFilePicker onFile={wizard.loadFile} />}

      {wizard.step === 'map' && (
        <>
          <p className="mb-4 text-body-sm text-text-secondary">
            Reading <span className="font-medium text-text-primary">{wizard.filename}</span> —{' '}
            {wizard.rowCount} row{wizard.rowCount === 1 ? '' : 's'}. We have guessed the columns;
            change any that are wrong.
          </p>

          <ImportColumnMapper
            headers={wizard.headers}
            mapping={wizard.mapping}
            onChange={wizard.setColumn}
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={wizard.runPreview} loading={wizard.busy} disabled={!mappingComplete}>
              Preview changes
            </Button>
            <Button variant="ghost" onClick={wizard.reset} disabled={wizard.busy}>
              Start over
            </Button>
          </div>
        </>
      )}

      {wizard.step === 'preview' && wizard.summary && (
        <>
          <ImportPreview summary={wizard.summary} plan={wizard.plan} issues={wizard.issues} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={wizard.commit}
              loading={wizard.busy}
              disabled={wizard.issues.length > 0 || wizard.summary.products === 0}
            >
              Import {wizard.summary.products} product{wizard.summary.products === 1 ? '' : 's'}
            </Button>
            <Button variant="outline" onClick={() => wizard.setStep('map')} disabled={wizard.busy}>
              Back to columns
            </Button>
            <Button variant="ghost" onClick={wizard.reset} disabled={wizard.busy}>
              Start over
            </Button>
          </div>
        </>
      )}

      {wizard.step === 'done' && wizard.result && (
        <div className="space-y-4">
          <div
            className={`rounded-surface border p-4 ${
              wizard.result.failed === 0
                ? 'border-success-border bg-success-background'
                : 'border-warning-border bg-warning-background'
            }`}
          >
            <div className="flex items-start gap-3">
              {wizard.result.failed === 0 ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              )}
              <div>
                <p className="font-semibold text-text-primary">
                  {wizard.result.succeeded} product{wizard.result.succeeded === 1 ? '' : 's'} imported
                  {wizard.result.failed > 0 && `, ${wizard.result.failed} failed`}
                </p>
                {wizard.result.failed > 0 && (
                  <ul className="mt-2 space-y-1 text-body-sm text-text-secondary">
                    {wizard.result.results
                      .filter((row) => !row.ok)
                      .map((row) => (
                        <li key={row.id}>
                          <span className="font-medium text-text-primary">{row.label || row.id}</span>
                          {' — '}
                          {row.error || 'Unknown error'}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/products"
              className="rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              View products
            </Link>
            <Button variant="outline" onClick={wizard.reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
