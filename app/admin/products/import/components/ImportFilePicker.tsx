/** ADMIN layer — step one: choose the file.
 *
 * Drop target as well as a button, because the file has usually just come out
 * of a spreadsheet and is sitting on the desktop. The expected shape is spelled
 * out rather than left to be discovered from a validation error, and the
 * quickest way to get a correct file is named: export the catalogue first and
 * edit that.
 */
'use client';

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui';
import ExportButton from '@/app/admin/components/ExportButton';

interface ImportFilePickerProps {
  onFile: (file: File) => void;
}

export function ImportFilePicker({ onFile }: ImportFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          take(event.dataTransfer.files);
        }}
        className={`rounded-surface border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border-strong bg-surface'
        }`}
      >
        <FileSpreadsheet className="mx-auto mb-4 size-12 text-text-muted" aria-hidden="true" />
        <p className="text-body-lg font-medium text-text-primary">Drop a CSV here</p>
        <p className="mt-1 text-body-sm text-text-secondary">or choose one from your computer</p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => take(event.target.files)}
        />

        <Button className="mt-4" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" />
          Choose file
        </Button>
      </div>

      <div className="rounded-surface border border-border bg-surface p-4">
        <h2 className="font-semibold text-text-primary">What the file should look like</h2>
        <p className="mt-1 text-body-sm text-text-secondary">
          One row per variant. Rows sharing a product name become one product, with each row a size
          and colour of it. Only <strong>name</strong> and <strong>price</strong> are required —
          everything else is optional, and any column you leave out is left untouched on products
          that already exist.
        </p>

        <pre className="mt-3 overflow-x-auto rounded-control bg-background-secondary p-3 text-caption-md text-text-secondary">
{`name,category,size,color,price,stock,cost
Cotton Romper,babies,0-3m,Red,1500,4,700
Cotton Romper,babies,0-3m,Blue,1500,2,700
Cotton Romper,babies,3-6m,Red,1800,1,850`}
        </pre>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-divider pt-4">
          <p className="text-body-sm text-text-secondary">
            Easiest start: export what you have, edit it, bring it back.
          </p>
          <ExportButton dataset="products" label="Export current catalogue" />
        </div>
      </div>
    </div>
  );
}
