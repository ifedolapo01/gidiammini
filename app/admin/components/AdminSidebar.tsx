/** ADMIN layer — the section navigation.
 *
 * A sidebar rather than a top bar because there are ten sections and counting.
 * Ten links, a brand, an account name, a theme toggle and a sign-out button do
 * not fit on one horizontal line at any width worth designing for — the old
 * header wrapped "Stock Management" onto two lines on a 1920px display. A
 * vertical list has room for the labels it already has and for whatever gets
 * added next.
 *
 * One component serves both the fixed desktop rail and the mobile drawer; only
 * the positioning differs, so the two can never drift apart.
 */
'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminConfig } from '../config';

interface AdminSidebarProps {
  pathname: string;
  /** Icon-only rail. Desktop only — the drawer always shows labels. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Present in the mobile drawer, absent in the desktop rail. */
  onClose?: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({
  pathname,
  collapsed,
  onToggleCollapsed,
  onClose,
}: AdminSidebarProps) {
  const isDrawer = Boolean(onClose);
  // The drawer is never collapsed: it is already hidden when not wanted, and an
  // icon-only overlay would be a puzzle rather than a shortcut.
  const iconsOnly = collapsed && !isDrawer;

  return (
    <div className="flex h-full flex-col bg-surface border-r border-border">
      <div
        className={cn(
          'flex items-center gap-2 border-b border-divider px-3 h-16 shrink-0',
          iconsOnly && 'justify-center px-2',
        )}
      >
        {!iconsOnly && (
          <Link
            href="/admin/dashboard"
            onClick={onClose}
            className="flex-1 truncate text-body-lg font-bold text-text-primary rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
          >
            {adminConfig.brandName}
          </Link>
        )}

        {isDrawer ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-11 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="grid size-11 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
          >
            {collapsed
              ? <PanelLeftOpen className="size-5" aria-hidden="true" />
              : <PanelLeftClose className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {adminConfig.navigation.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  // The title is the only label there is when collapsed, so it
                  // is always set rather than only when it would be truncated.
                  title={iconsOnly ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-control px-3 min-h-11 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
                    iconsOnly && 'justify-center px-0',
                    active
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {!iconsOnly && <span className="truncate text-body-sm">{item.label}</span>}
                  {/* Collapsed, the icon is the only thing on screen, so the
                      accessible name has to come from somewhere. */}
                  {iconsOnly && <span className="sr-only">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
