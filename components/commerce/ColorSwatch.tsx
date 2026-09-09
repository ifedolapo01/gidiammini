/** COMMERCE layer — a dot of the colour itself. Used by the facet rail and ProductCard. */
import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  value: string;
  className?: string;
}

/**
 * An admin types colour names freely, so the value is fed straight to CSS and
 * anything unrecognised ("Multicolour") simply resolves to nothing — which is
 * why the swatch keeps a border and never carries the meaning on its own. The
 * name is always spelled out beside it wherever this is used.
 */
export default function ColorSwatch({ value, className }: ColorSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-4 shrink-0 rounded-full border border-border-strong', className)}
      style={{ backgroundColor: value.toLowerCase().replace(/\s+/g, '') }}
    />
  );
}
