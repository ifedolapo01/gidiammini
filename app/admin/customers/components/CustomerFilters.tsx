/** ADMIN layer — search, segment and status filters over the buyer list.
 *
 * The tag chips are the segment control. A dropdown would hide the vocabulary
 * behind a click, and the vocabulary is the point: seeing that "wholesale" and
 * "wholesale buyer" both exist is how somebody notices they have made two
 * segments out of one.
 */
'use client';

import { Search, X } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CustomerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  tags: string[];
  activeTag: string;
  onTagChange: (tag: string) => void;
  blocked: string;
  onBlockedChange: (value: string) => void;
}

export default function CustomerFilters({
  search,
  onSearchChange,
  tags,
  activeTag,
  onTagChange,
  blocked,
  onBlockedChange,
}: CustomerFiltersProps) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, email or phone…"
            aria-label="Search customers"
            className="pl-9"
          />
        </div>

        <Select
          value={blocked}
          onChange={(event) => onBlockedChange(event.target.value)}
          aria-label="Filter by account status"
          className="sm:w-48"
        >
          <option value="">Everyone</option>
          <option value="false">Not blocked</option>
          <option value="true">Blocked only</option>
        </Select>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-caption-md uppercase tracking-wider text-text-secondary">
            Segments
          </span>

          {tags.map((tag) => {
            const active = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => onTagChange(active ? '' : tag)}
                className={cn(
                  'rounded-full border px-3 py-1 text-caption-md font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                {tag}
              </button>
            );
          })}

          {activeTag && (
            <button
              type="button"
              onClick={() => onTagChange('')}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption-md text-text-secondary hover:text-text-primary"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
