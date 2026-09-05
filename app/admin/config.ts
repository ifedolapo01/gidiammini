/**
 * ADMIN layer — white-label configuration.
 *
 * Everything brand- or deployment-specific about the Admin lives here (and in
 * the .theme-admin design tokens), never in component code. Rebranding the
 * Admin means editing this file and the token values only.
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Star,
  CircleQuestionMark, FolderTree, Percent, Truck, History,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  /** Shown beside the label, and on its own when the sidebar is collapsed —
   * which is why every item needs one rather than it being optional. */
  icon: LucideIcon;
  /** A shorter label for the collapsed rail's tooltip and for narrow screens.
   * Defaults to `label`. */
  shortLabel?: string;
}

/**
 * How admin accounts are organised in this deployment.
 *
 *   'named'  — one account per person. audit_log names who did what, and an
 *              account can be deactivated without disturbing anyone else.
 *   'shared' — one account the whole team signs into. Every action attributes
 *              to that one row.
 *
 * This is a deployment choice, not a code fork. Both modes are the same
 * mechanism — a Supabase Auth user allowlisted in public.admin_users — and
 * differ only in how many rows exist and what the Admin offers to manage them.
 * Nothing downstream of lib/api/admin-session.ts may branch on it: routes and
 * components read actor.id / actor.email / actor.name and behave identically
 * either way.
 *
 * It exists now, ahead of the UI that would use it, because the Admin is being
 * built to extract as a standalone product where each deployment picks one —
 * and retrofitting per-person identity later is far harder than leaving the
 * seam open.
 */
export type AdminIdentityMode = 'named' | 'shared';

export const adminConfig = {
  brandName: 'GidiamMini Admin',
  /** See AdminIdentityMode. */
  identityMode: 'named' as AdminIdentityMode,
  /**
   * Must match --primary in the .theme-admin token scope (app/globals.css).
   * The favicon (app/admin/icon.tsx) is generated outside the CSS cascade via
   * next/og, which can't read CSS custom properties — this literal value is
   * the single source of truth for that one exception.
   */
  primaryColorHex: '#2563eb',
  navigation: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/stock', label: 'Stock Management', icon: Boxes, shortLabel: 'Stock' },
    { href: '/admin/reviews', label: 'Reviews', icon: Star },
    { href: '/admin/questions', label: 'Questions', icon: CircleQuestionMark },
    { href: '/admin/categories', label: 'Categories', icon: FolderTree },
    { href: '/admin/discounts', label: 'Discounts', icon: Percent },
    { href: '/admin/shipping', label: 'Shipping', icon: Truck },
    { href: '/admin/activity', label: 'Activity', icon: History },
  ] satisfies AdminNavItem[],
};
