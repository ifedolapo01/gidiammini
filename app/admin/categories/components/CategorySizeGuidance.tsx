/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// The size guidance for one category.
//
// This is where the knowledge that currently lives in one person's head goes:
// "our sleepsuits have fold-over mittens so the arms run long", "the christening
// gowns are cut for a christening at three months, not six". Whoever answers
// the "will this fit" messages is the person who knows it, and it appears at
// the top of the size guide for every product in the category.
//
// Collapsed until opened, so the category list stays a list. The saved text is
// shown as a preview when closed, because "is there guidance on this one" is
// the question an admin scanning the page is asking.
'use client';

import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';

interface CategorySizeGuidanceProps {
  categoryName: string;
  categoryId: string;
  current: string | null;
  saving: boolean;
  onSave: (id: string, guidance: string) => void;
}

const MAX = 2000;

export function CategorySizeGuidance({
  categoryName,
  categoryId,
  current,
  saving,
  onSave,
}: CategorySizeGuidanceProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current ?? '');
  const fieldId = `size-guidance-${categoryId}`;

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-control bg-background-secondary p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-caption-md font-semibold uppercase tracking-wider text-text-secondary">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            Size guidance
          </p>
          <p className="mt-1 text-body-sm text-text-secondary">
            {current ? (
              <span className="line-clamp-2">{current}</span>
            ) : (
              <span className="italic text-text-muted">
                Nothing yet — shoppers see the measurement tables only.
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {current ? 'Edit' : 'Add guidance'}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-control border border-border bg-surface p-3">
      <label htmlFor={fieldId} className="mb-1 block text-body-sm font-medium text-text-primary">
        Size guidance for {categoryName}
      </label>
      <Textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX}
        rows={4}
        placeholder="Our sleepsuits have fold-over mittens, so the arms run a little long — most parents find the stated age band fits."
      />
      <p className="mt-1 text-caption-md text-text-secondary">
        Shown at the top of the size guide for every product in this category.{' '}
        {draft.length}/{MAX}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" loading={saving} onClick={() => onSave(categoryId, draft)}>
          Save guidance
        </Button>
        {current && (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => {
              setDraft('');
              onSave(categoryId, '');
            }}
          >
            Remove
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            setDraft(current ?? '');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
