/**
 * STOREFRONT layer — installs the service worker, once, after the page is up.
 *
 * Deliberately late and deliberately quiet. Registration competes for the same
 * connection as the page the visitor is waiting for, and on the connections
 * this shop is used on that trade is worth making after the first paint, never
 * before it.
 *
 * Renders nothing. Everything it does is a side effect, and every failure is
 * swallowed: a browser with no service-worker support, a private window that
 * refuses one, or an insecure origin all leave the storefront working exactly
 * as it did before any of this existed.
 */
'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // The dev server serves a different bundle on every edit, and a worker
    // caching those hashes turns every reload into a debugging session.
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    const register = () => {
      if (cancelled) return;

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // A newly installed worker takes over on the next navigation; this
          // asks it to take over now, so a visitor who has just been given a
          // fixed version is not held on the old one.
          registration.waiting?.postMessage('skip-waiting');
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
