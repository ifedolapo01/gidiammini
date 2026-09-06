/** ADMIN layer — the actions menu at the end of a table row.
 *
 * Admin tables kept growing a column of icon buttons, and a row of four
 * icon-only buttons costs more width than any column carrying actual
 * information — which is how the discounts table came to squeeze a product
 * name into two words per line. One trigger, and the actions behind it.
 *
 * THE PANEL HUGS ITS CONTENT
 *
 * Width is `max-content` between a floor and a ceiling, and the panel is
 * anchored by its right edge rather than a computed left. A fixed width would
 * leave a menu of two short verbs mostly empty, which is what makes a dropdown
 * look unfinished — and there is no reason for "Edit" and "Delete" to reserve
 * the space that "Notify subscribers" needs.
 *
 * Placement and dismissal live in useRowMenuPlacement — see its header for why
 * the panel is positioned in viewport coordinates.
 */
'use client';

import { MoreVertical } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useRowMenuPlacement } from '../hooks/useRowMenuPlacement';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Rendered in the destructive colour, below a rule. */
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** The row this belongs to. Names the trigger, so a screen reader hears
   *  "Actions for Gown Sales 2026" rather than a dozen identical buttons. */
  rowLabel: string;
  /** Swaps the trigger for a spinner while this row has work in flight. */
  busy?: boolean;
}

/** Wide enough that a two-word label never wraps, narrow enough that a
 *  one-word one does not float in space. */
const MIN_WIDTH = 176;
const MAX_WIDTH = 264;

const PLACEMENT = { itemHeight: 40, chrome: 12, gap: 6 };

function ActionItem({ action, onRun }: { action: RowAction; onRun: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={action.disabled}
      onClick={onRun}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-control py-2 pl-2 pr-3',
        'text-body-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        action.destructive
          ? 'text-destructive hover:bg-destructive-background focus-visible:bg-destructive-background'
          : 'text-text-primary hover:bg-surface-hover focus-visible:bg-surface-hover'
      )}
    >
      {/* A tinted tile rather than a bare glyph: it gives the row a consistent
          left edge whether or not an action has an icon, and it is what lets
          the destructive item read as different at a glance rather than only
          on close inspection. */}
      {action.icon && (
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-colors',
            action.destructive
              ? 'bg-destructive-background text-destructive group-hover:bg-destructive group-hover:text-text-inverse'
              : 'bg-background-tertiary text-text-secondary group-hover:bg-primary/10 group-hover:text-primary'
          )}
        >
          {action.icon}
        </span>
      )}
      {action.label}
    </button>
  );
}

export default function RowActionsMenu({ actions, rowLabel, busy }: RowActionsMenuProps) {
  const { open, placement, triggerRef, panelRef, toggle, close, onPanelKeyDown } =
    useRowMenuPlacement(actions.length, PLACEMENT);

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
          'inline-flex h-9 w-9 items-center justify-center rounded-control border border-transparent',
          'text-text-muted transition-colors',
          'hover:border-border hover:bg-surface-hover hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus',
          'disabled:opacity-60 disabled:pointer-events-none',
          // Held open, so the trigger does not look inert while its own menu is
          // on screen.
          open && 'border-border bg-surface-hover text-text-primary'
        )}
      >
        {busy ? <Spinner size="xs" /> : <MoreVertical size={18} aria-hidden />}
      </button>

      {open && placement && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Actions for ${rowLabel}`}
          onKeyDown={onPanelKeyDown}
          style={{
            top: placement.top,
            right: placement.right,
            width: 'max-content',
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH,
            transformOrigin: placement.above ? 'bottom right' : 'top right',
          }}
          className="animate-menuIn fixed z-50 rounded-overlay border border-border bg-surface p-1 shadow-elevation-4"
        >
          {actions.map((action, index) => {
            const previous = actions[index - 1];
            const startsDangerZone = action.destructive && previous && !previous.destructive;

            return (
              <div key={action.label}>
                {/* A rule above the first destructive item, so Delete is not
                    what a hurried click lands on by accident. */}
                {startsDangerZone && <div className="my-1 border-t border-border-light" />}
                <ActionItem
                  action={action}
                  onRun={() => {
                    close(false);
                    action.onClick();
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
