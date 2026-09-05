/** ADMIN layer — step two: say which column is which.
 *
 * Pre-filled by autoMapColumns, so a file this admin exported needs no edits at
 * all and the step is a glance rather than twelve decisions. It still has to
 * exist: the interesting imports are the ones from someone else's system, where
 * the price column is called "Amount".
 */
'use client';

import { Select } from '@/components/ui';
import { IMPORT_FIELDS, type ColumnMapping } from '@/lib/commerce/product-import';

interface ImportColumnMapperProps {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (field: string, index: number | null) => void;
}

export function ImportColumnMapper({ headers, mapping, onChange }: ImportColumnMapperProps) {
  const missingRequired = IMPORT_FIELDS.filter(
    (field) => field.required && typeof mapping[field.key] !== 'number'
  );

  return (
    <div className="space-y-4">
      {missingRequired.length > 0 && (
        <div role="alert" className="rounded-control border border-destructive-border bg-destructive-background p-3">
          <p className="text-body-sm font-medium text-destructive">
            Still needed: {missingRequired.map((field) => field.label).join(', ')}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-surface border border-border bg-surface">
        <table className="w-full">
          <thead className="bg-background-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                Field
              </th>
              <th scope="col" className="px-4 py-3 text-left text-caption-md font-medium uppercase tracking-wider text-text-secondary">
                Column in your file
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {IMPORT_FIELDS.map((field) => {
              const selectId = `import-map-${field.key}`;

              return (
                <tr key={field.key}>
                  <td className="px-4 py-3 align-top">
                    <label htmlFor={selectId} className="text-body-sm font-medium text-text-primary">
                      {field.label}
                      {field.required && <span className="ml-1 text-destructive">*</span>}
                    </label>
                    {field.hint && (
                      <p className="mt-0.5 text-caption-md text-text-secondary">{field.hint}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      id={selectId}
                      size="sm"
                      className="w-full max-w-xs"
                      value={typeof mapping[field.key] === 'number' ? String(mapping[field.key]) : ''}
                      invalid={field.required && typeof mapping[field.key] !== 'number'}
                      onChange={(event) =>
                        onChange(field.key, event.target.value === '' ? null : Number(event.target.value))
                      }
                    >
                      <option value="">— not in this file —</option>
                      {headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={index}>
                          {header || `Column ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
