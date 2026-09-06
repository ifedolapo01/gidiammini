/** ADMIN layer — the three-dot menu at the end of a table row.
 *
 * Admin tables kept growing a column of icon buttons, and a row of four
 * icon-only buttons costs more width than any of the columns carrying actual
 * information — which is how the discounts table ended up squeezing a product
 * name into two words per line. One trigger, and the actions behind it.
 *
 * WHY IT POSITIONS ITSELF WITH position: fixed
 *
 * These tables live inside `overflow-x-auto`, and an absolutely-positioned
 * dropdown inside a scroll container is clipped by it — the menu would open
 * and be cut off at the table's edge. Measuring the trigger and placing the
 * panel in viewport coordinates escapes the container entirely, without
 * needing a portal.
 *
 * The cost is that the panel does not follow the page if it moves, so any
 * scroll or resize closes it. That is the right trade: a menu that has drifted
 * away from its row is worse than one that closed.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Rendered in the destructive colour and separated from the rest. */
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** Names the row in the trigger's accessible label, so a screen reader hears
   *  "Actions for Gown Sales 2026" rather than twelve identical buttons. */
  rowLabel: string;
  /** Swaps the trigger for a spinner while this row has work in flight. */
  busy?: boolean;
}

/** Rough panel height per item, for deciding whether to open upwards. */
const ITEM_HEIGHT = 38;
const PANEL_PADDING = 16;
const PANEL_WIDTH = 200;

export default function RowActionsMenu({ actions, rowLabel, busy }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const height = actions.length * ITEM_HEIGHT + PANEL_PADDING;
    // Open upwards when there is not room below — the last row of a table is
    // exactly where this menu is most often used.
    const openUpwards = rect.bottom + height > window.innerHeight && rect.top > height;

    setPosition({
      top: openUpwards ? rect.top - height : rect.bottom + 4,
      // Right-aligned to the trigger, and never off the left edge.
      left: Math.max(8, rect.right - PANEL_WIDTH),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // No focus return: the person clicked somewhere else on purpose, and
      // yanking focus back to the row they just left is disorienting.
      close(false);
    };

    // See the header: the panel is in viewport coordinates, so anything that
    // moves the page under it has to dismiss it.
    const onReflow = () => close(false);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onReflow);
    // Capture, so a scroll inside the table's own overflow container counts.
    window.addEventListener('scroll', onReflow, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, close]);

  // Focus the first item on open, so the menu is usable from the keyboard
  // rather than merely reachable.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${rowLabel}`}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted',
          'transition-colors hover:bg-surface-hover hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus',
          'disabled:opacity-60 disabled:pointer-events-none'
        )}
      >
        {busy ? <Spinner size="xs" /> : <MoreHorizontal size={18} aria-hidden />}
      </button>

      {open && position && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Actions for ${rowLabel}`}
          style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
          className="fixed z-50 rounded-surface border border-border bg-surface py-1 shadow-elevation-3"
        >
          {actions.map((action, index) => {
            const previous = actions[index - 1];
            const startsDangerZone = action.destructive && previous && !previous.destructive;

            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  close(false);
                  action.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm transition-colors',
                  'focus-visible:outline-none focus-visible:bg-surface-hover',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  action.destructive
                    ? 'text-destructive hover:bg-destructive-background'
                    : 'text-text-primary hover:bg-surface-hover',
                  // A rule above the first destructive item, so Delete is not
                  // the thing a hurried click lands on by accident.
                  startsDangerZone && 'mt-1 border-t border-border-light pt-2'
                )}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
