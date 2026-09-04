/**
 * STOREFRONT layer — the header's category links, desktop and mobile.
 *
 * One component for both, because they were two hardcoded copies of the same
 * five links and had already drifted: the desktop nav and the burger menu each
 * spelled out Babies / Kids / Maternity, and neither knew about a category
 * added in the admin.
 */
'use client';

import Link from 'next/link';
import { buildStorefrontNavLinks, type CategoryNavItem } from '@/lib/commerce/storefront-nav';

interface StorefrontNavProps {
  categories: CategoryNavItem[];
  /** Desktop bar or the burger menu — same links, different chrome. */
  variant: 'desktop' | 'mobile';
  /** True when this link is the page currently being shown. */
  isActive: (href: string, category?: string) => boolean;
  /** Mobile only: closes the menu on navigation. */
  onNavigate?: () => void;
}

const DESKTOP_BASE = 'font-semibold text-body-sm lg:text-body-md transition-colors';
const MOBILE_BASE = 'py-2 px-3 sm:px-4 rounded-control text-body-sm sm:text-body-md font-medium';

export default function StorefrontNav({
  categories,
  variant,
  isActive,
  onNavigate,
}: StorefrontNavProps) {
  const links = buildStorefrontNavLinks(categories);
  const desktop = variant === 'desktop';

  return (
    <nav
      className={
        desktop
          ? 'hidden md:flex space-x-4 lg:space-x-6'
          : 'flex flex-col space-y-2 text-text-primary'
      }
      aria-label={desktop ? 'Main' : 'Mobile'}
    >
      {links.map((link) => {
        const active = isActive(link.href.split('?')[0], link.category);

        const className = desktop
          ? `${DESKTOP_BASE} ${active ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-primary'}`
          : `${MOBILE_BASE} ${active ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10'}`;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={className}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
