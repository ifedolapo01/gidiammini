/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * A definition on demand: an info icon that reveals a short line of text on
 * hover or focus, dismissible with Escape, and announced by a screen reader
 * via `aria-describedby` rather than only by sight. Nothing in `ui/` covered
 * this before — the only precedent was a bare `title=` attribute, which is
 * mouse-only and invisible to assistive tech.
 *
 * The trigger defaults to an info glyph so it reads as "more detail here"
 * wherever it lands (a stat card's title row, a panel header). Pass
 * `children` to make something else the trigger instead — the panel headers
 * use the heading text itself.
 */
'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  /** The definition shown in the popup. Plain text — this is a fact, not a UI. */
  content: string;
  /** Custom trigger. Defaults to a small info icon. */
  children?: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const close = () => setOpen(false);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') close();
  };

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        // Hover AND focus, per the plan — a mouse-only reveal leaves keyboard
        // users with no way to read the same definition.
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        aria-describedby={open ? id : undefined}
        aria-label={children ? undefined : 'More information'}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-text-muted transition-colors',
          'hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-offset-2 focus-visible:ring-focus',
          !children && 'p-0.5'
        )}
      >
        {children ?? <Info size={14} aria-hidden="true" />}
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[240px] -translate-x-1/2',
            'rounded-control border border-border bg-surface px-2.5 py-1.5 text-left',
            'text-caption-md text-text-secondary shadow-elevation-3'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
