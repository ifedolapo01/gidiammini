/**
 * CORE layer — what an image shows before it has pixels.
 *
 * Two things, both shared by every product image on the site so that a card in
 * the listing, a row in the cart and the gallery on the product page all behave
 * the same way while loading and all fail the same way when a URL is missing.
 *
 * The blur is one constant rather than a per-image preview stored at upload.
 * A per-image blur is more faithful, but it needs a column, a migration and a
 * backfill over the live catalogue, and it does nothing for the rows already
 * there until that backfill runs. This costs 46 bytes, applies to every product
 * that exists today, and buys the same thing the per-image version buys: the
 * box is never empty, so the page does not flash white where a photo is about
 * to land.
 */

/**
 * An 8x6 warm-grey WebP, inlined. Next renders it scaled up and blurred behind
 * the real image until that decodes.
 *
 * Deliberately contentless — it stands in for any product photo, so it must not
 * suggest a shape or a colour the real one turns out not to have. Regenerate
 * with sharp if the surface palette ever moves far from this.
 */
export const IMAGE_BLUR_DATA_URL =
  'data:image/webp;base64,UklGRiYAAABXRUJQVlA4IBoAAAAwAQCdASoIAAYABUB8JZwAA3AA/u89OBAAAA==';

/**
 * The asset a plain <img> falls back to when its URL will not load.
 *
 * Replaces `/placeholder.jpg`, which four call sites named as their fallback
 * and which has never existed in `public/` — every one of those fallbacks was
 * itself a 404 — and `https://via.placeholder.com/...`, which made the admin
 * panel call a third party to say an image was missing.
 *
 * Only for the handful of raw <img> tags that cannot use next/image (a data:
 * URI, a signed private URL, a local object URL). ProductImage does NOT point
 * <Image> at this: /_next/image answers 400 for SVG unless dangerouslyAllowSVG
 * is set, so it draws an icon instead and makes no request at all.
 */
export const IMAGE_FALLBACK_SRC = '/placeholder.svg';

/** Whether there is a URL worth rendering. Blank strings reach here from rows
 *  where the column is `''`, which is not the same as a real URL. */
export function hasImageSrc(src: string | null | undefined): src is string {
  return typeof src === 'string' && src.trim() !== '';
}

/** The hostname product images actually come from — this project's Supabase
 *  storage bucket, when configured. Shared with next.config.ts's
 *  remotePatterns so the two can never drift apart. */
export function supabaseImageHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Whether next/image's optimiser is configured to accept this URL's host.
 *
 * A CSV import, or a pasted URL in the admin form, can point `main_image` at
 * any host — a demo placeholder, a competitor's CDN, a typo. next/image
 * throws synchronously for a host outside remotePatterns rather than failing
 * the one image, which without this check takes down every page that renders
 * the product (the whole admin catalogue table, a product grid). Callers use
 * this to render such an image `unoptimized` instead: not run through the
 * optimiser, but not a crash either.
 */
export function isAllowedImageHost(src: string): boolean {
  try {
    const hostname = new URL(src).hostname;
    return hostname === supabaseImageHostname() || hostname === 'images.unsplash.com';
  } catch {
    return false;
  }
}
