/** ADMIN layer — jump anywhere with one keystroke.
 *
 * Ctrl/Cmd+K anywhere in the admin. It reaches the same server-side search the
 * list pages use, so it finds an order that is not on the page currently
 * loaded — which is the difference between a shortcut and a filter.
 *
 * Keyboard first, deliberately: it exists to save a hand leaving the keyboard.
 * Arrow keys move, Enter goes, Escape closes, and the highlighted row is
 * announced through aria-activedescendant rather than by moving focus off the
 * input, which would break typing.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAdminIdentity } from '../hooks/useAdminIdentity';
import { useCommandSearch, type CommandItem } from '../hooks/useCommandSearch';

const GROUP_ORDER: CommandItem['group'][] = ['Orders', 'Products', 'Pages', 'Actions'];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { admin } = useAdminIdentity();
  const { items, searching } = useCommandSearch(query, open, admin?.role ?? null);

  // Grouped for display, but flat for keyboard navigation — the index the
  // arrow keys move through has to match what is on screen.
  const ordered = useMemo(
    () => GROUP_ORDER.flatMap((group) => items.filter((item) => item.group === group)),
    [items]
  );

  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const go = (item: CommandItem | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (ordered.length === 0 ? 0 : (current + 1) % ordered.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (ordered.length === 0 ? 0 : (current - 1 + ordered.length) % ordered.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(ordered[active]);
    }
  };

  let rendered = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-surface border border-border bg-surface shadow-elevation-3"
      >
        <div className="flex items-center gap-3 border-b border-divider px-4">
          <Search className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search orders, products, pages…"
            aria-label="Search orders, products and pages"
            aria-controls="command-palette-results"
            aria-activedescendant={ordered[active] ? `cmd-${ordered[active].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-body-lg text-text-primary outline-none placeholder:text-text-muted"
          />
          {searching && <Spinner size="sm" />}
        </div>

        <ul id="command-palette-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {ordered.length === 0 && (
            <li className="px-3 py-8 text-center text-body-sm text-text-secondary">
              {query.trim() ? `Nothing matching “${query.trim()}”` : 'Start typing'}
            </li>
          )}

          {GROUP_ORDER.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;

            return (
              <li key={group}>
                <p className="px-3 pb-1 pt-3 text-caption-md font-medium uppercase tracking-wider text-text-muted">
                  {group}
                </p>
                <ul>
                  {groupItems.map((item) => {
                    rendered += 1;
                    const isActive = rendered === active;
                    const index = rendered;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          id={`cmd-${item.id}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(item)}
                          className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-hover'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{item.label}</span>
                          {item.hint && (
                            <span className="hidden shrink-0 truncate text-caption-md text-text-secondary sm:block">
                              {item.hint}
                            </span>
                          )}
                          {isActive && <CornerDownLeft className="size-4 shrink-0" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
