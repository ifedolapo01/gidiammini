/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CartProvider } from '@/components/CartProvider';
import { WishlistProvider } from '@/components/WishlistProvider';
import { Analytics } from "@vercel/analytics/next";
import StorefrontDiscountManager from '@/components/StorefrontDiscountManager';
import { Toaster } from '@/components/ui';
import { SITE_URL } from '@/lib/site-url';
import { CategoryProvider } from '@/components/CategoryProvider';
import { CartDrawerProvider } from '@/components/cart/CartDrawerProvider';
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar';
import OfflineBanner from '@/components/pwa/OfflineBanner';
import { loadCategoryNav } from '@/lib/commerce/category-nav';

/**
 * Inter, self-hosted.
 *
 * Previously `Inter` from `next/font/google`, which downloads the font from
 * Google at BUILD time — so every deploy needed Google Fonts to be reachable,
 * and the build failed outright when it wasn't (twice in one afternoon here).
 * A font is not a reason for a deploy to fail.
 *
 * The file is the latin subset of Inter v20, variable weight 100-900, taken
 * straight from Google's own CDN — the exact same bytes next/font was fetching,
 * now committed. One 48KB file covers every weight because Inter is a variable
 * font. Add app/fonts/inter-latin-ext-variable.woff2 and a second src entry if
 * the store ever needs the extended latin range.
 */
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  // Metric-adjusted local fallback, so text laid out before the font loads
  // doesn't visibly reflow when it arrives.
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

const SITE_NAME = 'GidiamMini';
const SITE_DESCRIPTION =
  'Premium clothing, maternity wear and essentials for babies, kids and pre-teens.';

/**
 * Site-wide defaults. Every page that exports its own metadata overrides the
 * parts it cares about and inherits the rest.
 *
 * `metadataBase` is what makes a page able to write `alternates.canonical:
 * '/products/123'` and have Next resolve it to an absolute URL — og:url and
 * canonical are both required to be absolute, and until this was set the only
 * metadata in the app was the block below, shared by the entire catalogue.
 *
 * The title template means a page exports `title: product.name` and the tab,
 * the SERP entry and the share card all read "Name | GidiamMini" without
 * anyone re-typing the suffix. `default` is what the home page gets, which is
 * why it is spelled out in full rather than run through the template.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Baby, Kids & Maternity Store`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Baby, Kids & Maternity Store`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_NG',
    images: [{ url: '/images/logo.png', alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Baby, Kids & Maternity Store`,
    description: SITE_DESCRIPTION,
    images: ['/images/logo.png'],
  },
  // Deliberately no index/follow directive. Indexable is already the default
  // without a robots tag, and stating it here put "index, follow" on *every*
  // response — including the 404 that notFound() renders, where Next emits its
  // own "noindex". Two contradictory robots tags is at best untidy; the same
  // mistake under `googleBot` would be worse, since a crawler-specific tag
  // outranks the generic one and would have told Google to index our 404s.
  //
  // What is left is the pair of directives that only widen what Google may
  // show and carry no indexing claim to conflict with: a full-size image
  // thumbnail (this is a clothing store — the picture is the product) and an
  // unclipped snippet.
  robots: {
    googleBot: { 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // iOS ignores the manifest's icons for "Add to Home Screen" and looks for
  // this one instead. Same artwork, built by scripts/build-pwa-icons.mjs.
  appleWebApp: {
    capable: true,
    title: 'GidiamMini',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // The colour behind the status bar in an installed window. Matches the
  // manifest's theme_color — see app/manifest.ts.
  themeColor: '#db2777',
}

/**
 * The category list is read here, once per request and cached, and handed to
 * the header and the footer directly. CategoryProvider carries the same list
 * to the product cards, which are rendered too far down to be passed a prop.
 * Before this, all three hardcoded Babies / Kids / Maternity, so the admin's
 * Categories page changed nothing a shopper could see.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await loadCategoryNav();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set data-theme before paint to avoid a flash of the wrong theme.
            Keep the storage key in sync with lib/theme.ts's THEME_STORAGE_KEY. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('gidiam-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${inter.className} theme-storefront`} suppressHydrationWarning>
        <CartProvider>
        <WishlistProvider>
        <CategoryProvider categories={categories}>
        {/* Inside CartProvider, because the drawer it mounts reads the cart. */}
        <CartDrawerProvider>
          <StorefrontDiscountManager />
          {/* Above the header, because a dropped connection explains
              everything else on the page. */}
          <OfflineBanner />
          <Header categories={categories} />
          <main className="min-h-screen overflow-x-hidden">{children}</main>
          <Analytics />
          <Footer categories={categories} />
        </CartDrawerProvider>
        </CategoryProvider>
        </WishlistProvider>
        </CartProvider>
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}