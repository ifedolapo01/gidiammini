/** ADMIN layer — what the command palette offers for a given query.
 *
 * Pages and actions are matched locally because they are a fixed list of ten
 * or so. Orders and products are searched on the server, through the same
 * endpoints the list pages use — which is what makes the palette able to find
 * an order that is not on the page you happen to be looking at, and a phone
 * number typed in a different format from the one on file.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminConfig } from '../config';

export interface CommandItem {
  id: string;
  group: 'Pages' | 'Actions' | 'Orders' | 'Products';
  label: string;
  hint?: string;
  href: string;
}

/** Things to do, as opposed to places to go. */
const ACTIONS: CommandItem[] = [
  { id: 'action:new-product', group: 'Actions', label: 'Add a product', href: '/admin/products/new' },
  { id: 'action:import', group: 'Actions', label: 'Import products from CSV', href: '/admin/products/import' },
  { id: 'action:pending', group: 'Actions', label: 'Show pending orders', href: '/admin/orders?filter=pending' },
  { id: 'action:overdue', group: 'Actions', label: 'Show overdue shipments', href: '/admin/orders?filter=overdue' },
  { id: 'action:low-stock', group: 'Actions', label: 'Show low stock', href: '/admin/stock?stock=low' },
];

const PAGES: CommandItem[] = adminConfig.navigation.map((item) => ({
  id: `page:${item.href}`,
  group: 'Pages',
  label: item.label,
  href: item.href,
}));

const SEARCH_DEBOUNCE_MS = 200;
const REMOTE_LIMIT = 5;

const matches = (item: CommandItem, query: string) =>
  item.label.toLowerCase().includes(query) || item.href.toLowerCase().includes(query);

export function useCommandSearch(query: string, enabled: boolean) {
  const [remote, setRemote] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();

  const local = useMemo(() => {
    const needle = trimmed.toLowerCase();
    const pool = [...PAGES, ...ACTIONS];
    return needle ? pool.filter((item) => matches(item, needle)) : pool;
  }, [trimmed]);

  useEffect(() => {
    // One character matches everything and is never what someone meant.
    if (!enabled || trimmed.length < 2) {
      setRemote([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);

      try {
        const query = `search=${encodeURIComponent(trimmed)}&limit=${REMOTE_LIMIT}`;
        const [orders, products] = await Promise.all([
          fetch(`/api/orders?${query}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/admin/products?${query}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        if (cancelled) return;

        const orderItems: CommandItem[] = (orders?.orders ?? []).map((order: any) => ({
          id: `order:${order.id}`,
          group: 'Orders' as const,
          label: order.order_number,
          hint: `${order.customer_name} · ${order.status}`,
          href: `/admin/orders?search=${encodeURIComponent(order.order_number)}`,
        }));

        const productItems: CommandItem[] = (products?.products ?? []).map((product: any) => ({
          id: `product:${product.id}`,
          group: 'Products' as const,
          label: product.name,
          hint: product.category,
          href: `/admin/products/edit/${product.id}`,
        }));

        setRemote([...orderItems, ...productItems]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, enabled]);

  return { items: [...local, ...remote], searching };
}
