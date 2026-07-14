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
  navigation: [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/stock', label: 'Stock Management' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/discounts', label: 'Discounts' },
  ] satisfies AdminNavItem[],
};
