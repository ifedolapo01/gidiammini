/**
 * STOREFRONT layer — a multi-select facet as a list of checkboxes.
 *
 * One component serves both size and colour, because they differ only in their
 * heading and their ordering — and two near-identical panels would drift the
 * first time one of them gained a feature.
 *
 * Long lists are capped with a "Show all" toggle. Twenty colours is a scroll
 * that buries every panel beneath it, and a shopper who wants an unusual colour
 * is willing to press one button to see it.
 */
'use client';

import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui';
import FacetSection from './FacetSection';

/** Past this many options the list collapses behind "Show all". */
const VISIBLE_LIMIT = 8;

interface CheckboxFacetProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Rendered before the label — the colour swatch, for the colour facet. */
  renderAdornment?: (value: string) => React.ReactNode;
}

export default function CheckboxFacet({
  title,
  options,
  selected,
  onToggle,
  renderAdornment,
}: CheckboxFacetProps) {
  const [expanded, setExpanded] = useState(false);
  const groupId = useId();

  // Nothing to choose between is not a filter; showing an empty panel just
  // makes the sidebar look broken.
  if (options.length === 0) return null;

  const visible = expanded ? options : options.slice(0, VISIBLE_LIMIT);
  const hiddenCount = options.length - visible.length;

  return (
    <FacetSection title={title} badge={selected.length}>
      <ul className="space-y-2" aria-label={title}>
        {visible.map((option) => {
          const inputId = `${groupId}-${option}`;
          return (
            <li key={option}>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-2 rounded-control py-0.5 text-body-sm text-text-primary hover:text-primary"
              >
                <Checkbox
                  id={inputId}
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                />
                {renderAdornment?.(option)}
                <span>{option}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((wasExpanded) => !wasExpanded)}
          className="mt-2 rounded-control text-caption-md font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </button>
      )}
    </FacetSection>
  );
}
