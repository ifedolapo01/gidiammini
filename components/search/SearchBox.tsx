/**
 * STOREFRONT layer — the header search box and its typeahead.
 *
 * Keyboard-first: the input is a combobox, the dropdown a listbox, and the
 * highlighted option is announced through aria-activedescendant. Arrow keys
 * move, Enter opens, Escape closes without clearing what was typed. A search
 * that only works with a mouse is not finished.
 *
 * Enter with nothing highlighted goes to the full results page rather than
 * guessing at the first match, so a query that returns forty things is not
 * silently reduced to one.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { isSearchable } from '@/lib/commerce/search-query';
import { useProductSearch } from './hooks/useProductSearch';
import SearchDropdown from './SearchDropdown';

export default function SearchBox({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  /** -1 means "nothing highlighted"; Enter then goes to the results page. */
  const [highlighted, setHighlighted] = useState(-1);

  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { products, categories, loading, error, resultsFor } = useProductSearch(query);

  /** Products then category shortcuts, as one keyboard-navigable list. */
  const options = [
    ...products.map((product) => ({
      key: `p-${product.id}`,
      href: `/products/${product.id}`,
      label: product.name,
    })),
    ...categories.map((category) => ({
      key: `c-${category.href}`,
      href: category.href,
      label: category.label,
    })),
  ];

  // A new query invalidates whatever was highlighted.
  useEffect(() => setHighlighted(-1), [resultsFor]);

  // Close when focus or a click leaves the box entirely.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const submit = () => {
    if (!isSearchable(query)) return;
    go(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) return;
      setOpen(true);
      setHighlighted((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        // Wraps, and -1 stays reachable so Enter can mean "see everything".
        if (next >= options.length) return -1;
        if (next < -1) return options.length - 1;
        return next;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted >= 0 && options[highlighted]) go(options[highlighted].href);
      else submit();
      return;
    }

    if (event.key === 'Escape') {
      // Closes without clearing: the query is usually still wanted.
      setOpen(false);
      setHighlighted(-1);
    }
  };

  const showDropdown = open && isSearchable(query);
  const activeId = highlighted >= 0 ? `${listId}-${highlighted}` : undefined;

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search products
        </label>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
        />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products…"
          className="w-full h-10 pl-9 pr-9 rounded-control border border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:border-focus"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary rounded-control"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {showDropdown && (
        <SearchDropdown
          listId={listId}
          query={query}
          products={products}
          categories={categories}
          loading={loading}
          error={error}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onSelect={go}
          onSeeAll={submit}
        />
      )}
    </div>
  );
}
