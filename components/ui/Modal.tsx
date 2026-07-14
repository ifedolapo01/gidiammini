/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * Built on the native <dialog> element: focus is trapped while open,
 * Escape closes, and focus returns to the triggering element on close
 * (per the design system's overlay accessibility rules).
 */
'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export type ModalSize = keyof typeof sizes;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  /** Close when the backdrop is clicked (default true). */
  dismissible?: boolean;
  /** Suppress the built-in header row entirely; children own the header and close control. */
  hideHeader?: boolean;
  /** Accessible name for the dialog when hideHeader is set (or title is omitted). */
  ariaLabel?: string;
  /** Extra classes on the built-in header row — e.g. a tinted or bordered header for forms. */
  headerClassName?: string;
  /** Remove the default body padding, letting children control their own (pairs with hideHeader for full-bleed content). */
  padded?: boolean;
  /** Cap the dialog height and let the body scroll — for large forms. */
  scrollable?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  dismissible = true,
  hideHeader = false,
  ariaLabel,
  headerClassName,
  padded = true,
  scrollable = false,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /* Native <dialog> doesn't lock body scroll. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && title ? titleId : undefined}
      onCancel={(event) => {
        /* Escape key: keep state in sync with the parent. */
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        /* Clicks on the dialog element itself hit the backdrop area. */
        if (dismissible && event.target === dialogRef.current) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-overlay bg-surface p-0 text-text-primary shadow-elevation-4',
        'backdrop:bg-overlay backdrop:backdrop-blur-sm',
        'open:animate-modalIn',
        sizes[size],
        scrollable && 'flex flex-col max-h-[85vh]',
        className,
      )}
    >
      {!hideHeader && (
        <div className={cn('flex items-start justify-between gap-4 p-6 pb-0', scrollable && 'shrink-0', headerClassName)}>
          {title ? (
            <h2 id={titleId} className="text-h5 font-semibold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-m-2 rounded-control p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={cn(padded && 'p-6', scrollable && 'overflow-y-auto')}>{children}</div>
    </dialog>
  );
}
