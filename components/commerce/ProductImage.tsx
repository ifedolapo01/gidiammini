/**
 * COMMERCE layer — one product image, optimised. Used by Storefront and Admin.
 *
 * Every product image on the site went through a raw <img> with no width, no
 * height, no srcset and no lazy-loading policy: a 1920px original decoded down
 * to a 48px cart thumbnail, and a box that was zero pixels tall until the
 * bytes landed. This is the single component that fixes both, so a card, a
 * cart line and an admin table row cannot drift apart on any of it.
 *
 * It always uses `fill`, which is what lets the caller own the shape. The
 * wrapper it renders declares that shape — a fixed size, or an aspect ratio —
 * so the space is reserved before the image exists and nothing below it moves
 * when it arrives. `fill` also means no call site has to know a photo's
 * intrinsic dimensions, which is just as well: nothing in the database records
 * them.
 *
 * Deliberately free of event handlers by default, so it stays renderable from
 * a server component.
 */
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { IMAGE_BLUR_DATA_URL, hasImageSrc } from '@/lib/image-placeholder';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string | null | undefined;
  /** Empty string for a decorative thumbnail sitting beside its own product
   *  name — announcing the name twice helps nobody. */
  alt: string;
  /**
   * Which widths the browser should choose between. Required, and not defaulted:
   * a wrong `sizes` is worse than none, because it silently downloads either a
   * blurry image or a needlessly large one, and the right answer depends on a
   * layout only the caller can see. Use a CSS length for a fixed box ("48px")
   * and viewport units for a fluid one.
   */
  sizes: string;
  /** Sizing and shape for the box — "h-12 w-12", "aspect-square w-full". */
  className?: string;
  /** `cover` fills and crops; `contain` fits the whole photo inside the box. */
  fit?: 'cover' | 'contain';
  /**
   * Opts this image out of lazy loading. For the one image that is the page's
   * largest paint and is on screen at load — a hero, a gallery's first frame.
   * Marking more than that competes for the same bandwidth and makes the real
   * LCP later, not sooner.
   */
  priority?: boolean;
  /** Extra classes for the <img> itself, e.g. a hover transform. */
  imageClassName?: string;
  /**
   * Called when the URL was present but would not load — a deleted storage
   * object, a bucket that went private. Only the gallery passes this, because
   * only there is one broken photo worth recovering from rather than showing a
   * broken frame. Passing it makes the caller a client component, which is why
   * it is opt-in.
   */
  onError?: () => void;
}

export default function ProductImage({
  src,
  alt,
  sizes,
  className,
  fit = 'cover',
  priority = false,
  imageClassName,
  onError,
}: ProductImageProps) {
  const box = cn('relative overflow-hidden bg-background-tertiary', className);

  // No image: draw the empty state here rather than pointing <Image> at a
  // placeholder file. Routing a fallback through the optimiser costs a request
  // for a picture of nothing, and an SVG one is refused outright — /_next/image
  // answers 400 for SVG unless dangerouslyAllowSVG is on, which would let every
  // allowed remote host serve scriptable markup through our own origin. An
  // icon needs no request and cannot 400.
  if (!hasImageSrc(src)) {
    return (
      <div className={cn(box, 'flex items-center justify-center')} role="img" aria-label={alt || 'No image'}>
        <ImageOff className="h-1/3 w-1/3 max-h-8 max-w-8 text-text-muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={box}>
      <Image
        src={src.trim()}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={IMAGE_BLUR_DATA_URL}
        onError={onError}
        className={cn(fit === 'cover' ? 'object-cover' : 'object-contain', imageClassName)}
      />
    </div>
  );
}
