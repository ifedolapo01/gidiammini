/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// What the storefront calls one category.
//
// The navigation, the footer and the product cards render this, so it is the
// field that makes this page matter: before it existed they hardcoded three
// names, and adding a category here changed nothing a shopper could see.
//
// Separate from `name` on purpose. `name` is how this page lists and
// identifies the category and is UNIQUE; this is free text, and clearing it
// falls back to `name`.
'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { CATEGORY_LIMITS } from '@/lib/commerce/category-edit';

interface CategoryDisplayNameProps {
  categoryId: string;
  /** The admin-facing name, which is also the fallback label. */
  categoryName: string;
  current: string | null;
  saving: boolean;
  onSave: (id: string, displayName: string) => void;
}

const MAX = CATEGORY_LIMITS.display_name;

export function CategoryDisplayName({
  categoryId,
  categoryName,
  current,
  saving,
  onSave,
}: CategoryDisplayNameProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current ?? '');
  const fieldId = `display-name-${categoryId}`;

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-control bg-background-secondary p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-caption-md font-semibold uppercase tracking-wider text-text-secondary">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            Storefront name
          </p>
          <p className="mt-1 truncate text-body-sm text-text-secondary">
            {current ?? (
              <span className="italic text-text-muted">
                Shoppers see &ldquo;{categoryName}&rdquo;.
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {current ? 'Edit' : 'Rename'}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-control border border-border bg-surface p-3">
      <label htmlFor={fieldId} className="mb-1 block text-body-sm font-medium text-text-primary">
        What shoppers call {categoryName}
      </label>
      <Input
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX}
        placeholder={categoryName}
      />
      <p className="mt-1 text-caption-md text-text-secondary">
        Shown in the menu, the footer and on every product card in this
        category. Leave it empty to use &ldquo;{categoryName}&rdquo;.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" loading={saving} onClick={() => onSave(categoryId, draft)}>
          Save name
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
            Reset
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
