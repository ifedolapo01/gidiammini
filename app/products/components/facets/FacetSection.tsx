/**
 * STOREFRONT layer — the shell every facet panel sits in.
 *
 * A collapsible section with one heading. Exists so the sidebar's panels are
 * consistent by construction rather than by five components each remembering to
 * style their own heading the same way.
 *
 * Collapsing is a <button> driving aria-expanded and a real hidden attribute,
 * not a CSS height trick, so a screen reader and a keyboard both agree with the
 * sighted view about whether the panel is open.
 */
'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FacetSectionProps {
  title: string;
  /** Shown beside the title — usually how many values are selected. */
  badge?: number;
  /** Panels below the fold start closed so the sidebar stays scannable. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function FacetSection({
  title,
  badge = 0,
  defaultOpen = true,
  children,
}: FacetSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="border-t border-divider pt-4 first:border-t-0 first:pt-0">
      <h4>
        <button
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-2 rounded-control py-1 text-left font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex items-center gap-2">
            {title}
            {badge > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption-md font-semibold text-primary">
                {badge}
              </span>
            )}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h4>

      <div id={panelId} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}
