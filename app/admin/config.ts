/**
 * ADMIN layer — white-label configuration.
 *
 * Everything brand- or deployment-specific about the Admin lives here (and in
 * the .theme-admin design tokens), never in component code. Rebranding the
 * Admin means editing this file and the token values only.
 */

export interface AdminNavItem {
  href: string;
  label: string;
}

export const adminConfig = {
  brandName: 'GidiamMini Admin',
  /**
   * Must match --primary in the .theme-admin token scope (app/globals.css).
   * The favicon (app/admin/icon.tsx) is generated outside the CSS cascade via
   * next/og, which can't read CSS custom properties — this literal value is
   * the single source of truth for that one exception.
   */
  primaryColorHex: '#2563eb',
  navigation: [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/stock', label: 'Stock Management' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/discounts', label: 'Discounts' },
    { href: '/admin/shipping', label: 'Shipping' },
  ] satisfies AdminNavItem[],
};
