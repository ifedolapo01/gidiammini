/**
 * STOREFRONT layer — what an installed GidiamMini looks like.
 *
 * Mobile data here is metered and connections drop, and there is no app-store
 * presence to fall back on. A manifest plus a service worker is the whole
 * difference between "a website they have to find again" and an icon on the
 * home screen that opens instantly and still shows something on a train.
 *
 * A route rather than a static file so the name, colours and start URL come
 * from the same place the rest of the site's metadata does.
 */
import type { MetadataRoute } from 'next';

/** --primary in the storefront theme, and the colour the icons are built
 *  around. Keep scripts/build-pwa-icons.mjs in step with it. */
const BRAND = '#db2777';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GidiamMini — Baby, Kids & Maternity',
    // What fits under a home-screen icon. Android truncates around 12
    // characters, so the long name is never the one shown there.
    short_name: 'GidiamMini',
    description:
      'Premium clothing, maternity wear and essentials for babies, kids and pre-teens.',

    // The catalogue, not the homepage. Somebody who installed the shop is
    // coming back to shop; the marketing page is one tap away and the
    // products are what they wanted.
    start_url: '/products',
    // Everything under the root: the cart and checkout have to stay inside the
    // installed window, or paying would kick them out to a browser tab.
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',

    // The splash screen and the Android task-switcher chrome. White ground
    // because the storefront is a light surface and a pink flash before a
    // white page reads as a fault.
    background_color: '#ffffff',
    theme_color: BRAND,
    lang: 'en-NG',
    dir: 'ltr',
    categories: ['shopping', 'lifestyle'],

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate artwork with a wider safe zone — a launcher crops this one to
      // its own shape, and the "any" icons would lose their edges to it.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],

    // Long-press the installed icon. The three things somebody opens the shop
    // to do, without going through the homepage first.
    shortcuts: [
      {
        name: 'Browse products',
        short_name: 'Shop',
        url: '/products',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Your cart',
        short_name: 'Cart',
        url: '/cart',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Track an order',
        short_name: 'Track',
        url: '/track-order',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
