/**
 * ADMIN layer — white-label configuration.
 *
 * Everything brand- or deployment-specific about the Admin lives here (and in
 * the .theme-admin design tokens), never in component code. Rebranding the
 * Admin means editing this file and the token values only.
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Star, ReceiptText,
  CircleQuestionMark, FolderTree, Percent, Truck, History, Users, Contact, Settings,
} from 'lucide-react';
import type { AdminPermission } from '@/lib/api/admin-roles';

export interface AdminNavItem {
  href: string;
  label: string;
  /** Shown beside the label, and on its own when the sidebar is collapsed —
   * which is why every item needs one rather than it being optional. */
  icon: LucideIcon;
  /** A shorter label for the collapsed rail's tooltip and for narrow screens.
   * Defaults to `label`. */
  shortLabel?: string;
  /**
   * Hidden from anyone whose role does not hold this.
   *
   * Presentation only — the API enforces the same permission on every request,
   * so a hidden link is a courtesy rather than a control. What it prevents is
   * a fulfilment assistant clicking Activity and being told no; what it does
   * not prevent is anything at all.
   */
  permission?: AdminPermission;
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
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'store:read' },
    { href: '/admin/products', label: 'Products', icon: Package, permission: 'store:read' },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, permission: 'orders:read' },
    // Directly under Orders, and above everything else: on most mornings this
    // is the first screen anybody opens, and verification is the task the
    // whole shop waits on.
    { href: '/admin/payments', label: 'Verify Payments', icon: ReceiptText, shortLabel: 'Payments', permission: 'orders:read' },
    // Beside Orders, not down with the catalogue: a customer is looked up
    // because of an order, almost every time. Behind customers:read, which is
    // deliberately narrower than orders:read — the customer database holds
    // every address anybody has ever used, while an order exposes only its own.
    { href: '/admin/customers', label: 'Customers', icon: Contact, permission: 'customers:read' },
    { href: '/admin/stock', label: 'Stock Management', icon: Boxes, shortLabel: 'Stock', permission: 'store:read' },
    { href: '/admin/reviews', label: 'Reviews', icon: Star, permission: 'store:read' },
    { href: '/admin/questions', label: 'Questions', icon: CircleQuestionMark, permission: 'store:read' },
    { href: '/admin/categories', label: 'Categories', icon: FolderTree, permission: 'store:read' },
    { href: '/admin/discounts', label: 'Discounts', icon: Percent, permission: 'store:read' },
    { href: '/admin/shipping', label: 'Shipping', icon: Truck, permission: 'store:read' },
    { href: '/admin/activity', label: 'Activity', icon: History, permission: 'audit:read' },
    { href: '/admin/team', label: 'Team', icon: Users, permission: 'team:read' },
    // Last, and behind store:read rather than settings:write. The page itself
    // is read-only for anyone who cannot write — "what tax rate are we
    // charging" is a fair question for a manager, and hiding the link answers
    // it by making them ask someone.
    { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'store:read' },
  ] satisfies AdminNavItem[],
};
