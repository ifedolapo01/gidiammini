/**
 * CORE layer — which permission each admin endpoint requires.
 *
 * Kept as a table rather than an argument on every route because enforcement
 * that each route opts into is enforcement that a route added next year
 * forgets. withAdminAuth consults this for every request, so a new endpoint is
 * governed whether or not its author thought about permissions — and if they
 * did not, the fallback below refuses it rather than waving it through.
 *
 * A route that genuinely does not fit the table can pass an explicit
 * `permission` to withAdminAuth; the table still applies to everything else.
 */
import type { AdminPermission } from './admin-roles';

interface RoutePermission {
  /** Path pattern. A `*` matches exactly one segment, so the one-product
   * pattern does not also match the stock endpoint underneath it. */
  pattern: string;
  /** GET and HEAD. */
  read: AdminPermission;
  /** POST, PUT, PATCH and DELETE. Omitted where the route has none. */
  write?: AdminPermission;
}

/**
 * Order does not matter — the most specific matching pattern wins, measured in
 * literal (non-`*`) segments. That is what lets the stock endpoints sit inside
 * the products tree with a permission of their own.
 */
const ROUTES: RoutePermission[] = [
  // Orders. Both trees: the admin-only ones under /api/admin/orders and the
  // shared /api/orders routes whose GET is the admin list.
  { pattern: '/api/orders', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/summary', read: 'orders:read' },
  { pattern: '/api/orders/bulk', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/change-requests/*', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/*', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/*/shipping', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/*/notify', read: 'orders:read', write: 'orders:write' },
  // The order's notification timeline, and re-sending one of it. Same
  // permission as sending a message in the first place, because that is what a
  // resend is.
  { pattern: '/api/orders/*/notifications', read: 'orders:read', write: 'orders:write' },
  // Editing an order's lines moves stock and changes what the customer owes,
  // which is what orders:write already means. Deliberately not a permission of
  // its own: whoever can cancel an order can already destroy more value than
  // whoever can swap a colour on one.
  { pattern: '/api/orders/*/items', read: 'orders:read', write: 'orders:write' },
  // Refunds are money leaving the business, so they sit behind orders:write
  // rather than store:read — a fulfilment assistant who can mark a parcel
  // shipped can also refund the customer whose parcel was lost, which is the
  // shape of the actual job.
  { pattern: '/api/orders/*/refunds', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/orders/*/refunds/*', read: 'orders:read', write: 'orders:write' },
  // Correcting a waybill after the fact. Same permission as shipping the order
  // it belongs to — it is the same act, done a day late.
  { pattern: '/api/orders/*/tracking', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/admin/orders/*/receipt', read: 'orders:read' },

  // Payment verification. Confirming that money arrived is part of working an
  // order, not a separate privilege: whoever can move an order to 'confirmed'
  // by hand can already do the thing this replaces, and doing it through the
  // queue is strictly better recorded.
  { pattern: '/api/admin/payments', read: 'orders:read', write: 'orders:write' },
  { pattern: '/api/admin/payments/queue', read: 'orders:read' },

  // Catalogue. Stock is carved out of it on purpose: adjusting a count is a
  // warehouse job, changing a price or deleting a product is not.
  { pattern: '/api/admin/products', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/products/catalog', read: 'store:read' },
  { pattern: '/api/admin/products/summary', read: 'store:read' },
  { pattern: '/api/admin/products/bulk', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/products/import', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/products/stock', read: 'store:read' },
  { pattern: '/api/admin/products/*', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/products/*/stock', read: 'store:read', write: 'stock:write' },

  { pattern: '/api/admin/categories', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/subcategories', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/discounts', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/discounts/notify', read: 'store:read', write: 'catalog:write' },
  { pattern: '/api/admin/shipping-zones', read: 'store:read', write: 'catalog:write' },

  // Moderation.
  { pattern: '/api/admin/reviews', read: 'store:read', write: 'moderation:write' },
  { pattern: '/api/admin/reviews/*', read: 'store:read', write: 'moderation:write' },
  { pattern: '/api/admin/questions', read: 'store:read', write: 'moderation:write' },
  { pattern: '/api/admin/questions/*', read: 'store:read', write: 'moderation:write' },

  // The customer database, as distinct from the addresses on an order.
  { pattern: '/api/admin/customers', read: 'customers:read', write: 'customers:write' },
  // More specific than the wildcard below it, so a segment message is governed
  // by its own entry rather than by the one-customer editor's.
  { pattern: '/api/admin/customers/campaign', read: 'customers:read', write: 'customers:write' },
  { pattern: '/api/admin/customers/*', read: 'customers:read', write: 'customers:write' },

  // Everyday reads, available to anyone who can see the shop at all.
  { pattern: '/api/admin/dashboard', read: 'store:read' },
  { pattern: '/api/admin/dashboard/charts', read: 'store:read' },
  { pattern: '/api/admin/alerts/*', read: 'store:read' },
  // The rows behind a worklist count. Same reach as the dashboard it is part
  // of: it shows customer names and order numbers, which orders:read and
  // store:read both already expose.
  { pattern: '/api/admin/worklist/*', read: 'store:read' },
  { pattern: '/api/admin/wishlist', read: 'store:read' },
  { pattern: '/api/admin/realtime-token', read: 'store:read' },

  { pattern: '/api/admin/audit-log', read: 'audit:read' },
  { pattern: '/api/admin/export/*', read: 'export:read' },
  { pattern: '/api/admin/team', read: 'team:read', write: 'team:manage' },
  { pattern: '/api/admin/team/*', read: 'team:read', write: 'team:manage' },

  // Reporting surfaces. All store:read, because each is the same data the
  // screen beside it already shows, read a different way — and a fulfilment
  // assistant deciding what to pick benefits from knowing what is running out.
  { pattern: '/api/admin/dashboard/period', read: 'store:read' },
  { pattern: '/api/admin/discounts/performance', read: 'store:read' },
  { pattern: '/api/admin/stock/insights', read: 'store:read' },
  { pattern: '/api/admin/stock/aging', read: 'store:read' },

  // Automation. Readable by everyone who works here; switching a rule on is
  // owner-only, because a rule that cancels orders is a standing instruction
  // to the business rather than a screen preference.
  { pattern: '/api/admin/automation', read: 'store:read', write: 'settings:write' },

  // Read and write deliberately far apart. The order editor's tax preview and
  // the stock page's threshold both read this, so anyone who can see those
  // screens can read the row; writing it sets the bank account customers
  // transfer money to, which is owner-only.
  { pattern: '/api/admin/settings', read: 'store:read', write: 'settings:write' },
];

/**
 * An endpoint nobody added to the table.
 *
 * Owner-level in both directions, and logged. The alternative — assuming a
 * missing entry means "harmless" — is how a permission model quietly stops
 * meaning anything.
 */
const UNLISTED: Required<RoutePermission> = {
  pattern: '',
  read: 'audit:read',
  write: 'team:manage',
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Does `pathname` match `pattern`, treating `*` as one segment? */
function matches(pathSegments: string[], patternSegments: string[]): boolean {
  if (pathSegments.length !== patternSegments.length) return false;
  return patternSegments.every((segment, i) => segment === '*' || segment === pathSegments[i]);
}

/** How specific a pattern is: literal segments beat wildcards. */
function specificity(patternSegments: string[]): number {
  return patternSegments.filter((segment) => segment !== '*').length;
}

/**
 * The permission a request needs, and whether the table actually knew about it.
 *
 * `listed: false` means the fallback was used, which the caller logs — this is
 * a development-time signal, not something an operator can act on.
 */
export function permissionForRequest(
  method: string,
  pathname: string
): { permission: AdminPermission; listed: boolean } {
  const segments = pathname.replace(/\/+$/, '').split('/');
  const isRead = READ_METHODS.has(method.toUpperCase());

  let best: RoutePermission | null = null;
  let bestScore = -1;

  for (const route of ROUTES) {
    const patternSegments = route.pattern.split('/');
    if (!matches(segments, patternSegments)) continue;

    const score = specificity(patternSegments);
    if (score > bestScore) {
      best = route;
      bestScore = score;
    }
  }

  if (!best) return { permission: isRead ? UNLISTED.read : UNLISTED.write, listed: false };

  // A listed route with no write permission takes writes it does not describe
  // back to the fallback rather than reusing its read permission — otherwise
  // adding a POST to a read-only endpoint would silently inherit read access.
  if (!isRead && !best.write) return { permission: UNLISTED.write, listed: false };

  return { permission: isRead ? best.read : best.write!, listed: true };
}
