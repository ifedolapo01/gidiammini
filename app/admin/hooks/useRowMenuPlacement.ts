/** ADMIN layer — where a row-actions panel opens, and when it closes.
 *
 * Split from RowActionsMenu.tsx so that file is the markup and this is the
 * behaviour. All of it is about one constraint: admin tables live inside
 * `overflow-x-auto`, and an absolutely-positioned dropdown inside a scroll
 * container is clipped by it. Measuring the trigger and placing the panel in
 * viewport coordinates escapes the container without needing a portal.
 *
 * The cost is that the panel does not follow the page if it moves, so any
 * scroll or resize dismisses it. That is the right trade: a menu that has
 * drifted away from its row is worse than one that closed.
 *
 * Despite the name it is not row-specific — the column-visibility menu in the
 * table toolbar uses it too. Anything with a trigger and a panel of menu items
 * wants exactly this placement and exactly these dismissal rules.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `^=` rather than `=`, so this matches menuitemcheckbox and menuitemradio as
 * well as menuitem. The column-visibility menu is a list of checkboxes and
 * needs the same arrow-key roving as a list of plain actions.
 */
const MENU_ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

export interface MenuPlacement {
  top: number;
  /** Distance from the viewport's right edge.
   *
   *  Anchored by `right` rather than a computed `left` so the panel can size
   *  itself to its content — a left coordinate would have to be derived from a
   *  width the panel does not have until it renders, which is what forces
   *  every fixed-width dropdown to be too wide for its shortest menu. */
  right: number;
  /** True when there was no room below and it opened upwards. The panel uses
   *  this to grow from its bottom edge instead of appearing to fall out of the
   *  row above. */
  above: boolean;
}

interface PlacementOptions {
  /** Rough per-item height. Generous on purpose, so the guess errs towards
   *  flipping early rather than opening off-screen. */
  itemHeight: number;
  /** The padding around the items. */
  chrome: number;
  /** Distance from the trigger, and the minimum from any viewport edge. */
  gap: number;
}

export function useRowMenuPlacement(itemCount: number, options: PlacementOptions) {
  const { itemHeight, chrome, gap } = options;

  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = placement !== null;

  const close = useCallback((returnFocus = true) => {
    setPlacement(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    if (placement) return close();

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const height = itemCount * itemHeight + chrome;
    // The last row of a table is exactly where this menu is most often used.
    const above = rect.bottom + height + gap > window.innerHeight && rect.top > height;

    setPlacement({
      top: above ? rect.top - height - gap : rect.bottom + gap,
      // Right edges aligned, and never flush against the viewport.
      right: Math.max(gap, window.innerWidth - rect.right),
      above,
    });
  }, [placement, close, itemCount, itemHeight, chrome, gap]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // No focus return: the person clicked elsewhere on purpose, and yanking
      // focus back to the row they just left is disorienting.
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

  /** Focus lands on the first item, so the menu is usable from the keyboard
   *  rather than merely reachable. */
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLButtonElement>(MENU_ITEM_SELECTOR)?.focus();
    }
  }, [open]);

  /**
   * Roving focus within the panel. Home and End are included because a
   * destructive item sits last, and reaching it deliberately should be one key
   * rather than a run of arrows past everything else.
   */
  const onPanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>(MENU_ITEM_SELECTOR) ?? []
    );
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length].focus();
    };

    if (event.key === 'ArrowDown') focus(current + 1);
    else if (event.key === 'ArrowUp') focus(current - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
  }, []);

  return { open, placement, triggerRef, panelRef, toggle, close, onPanelKeyDown };
}
