/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * A naira sign drawn as a stroked glyph, sized and coloured the way every
 * lucide icon in this codebase is: `currentColor`, a 24-unit box, and a
 * stroke width that matches lucide's default. It exists so the dashboard's
 * revenue cards can carry the same icon treatment as their neighbours without
 * pulling in a second icon library — the whole of @fortawesome was shipping
 * for this one glyph.
 *
 * Purely decorative wherever it is used (the card states "Revenue" in text
 * beside it), so it is aria-hidden by default. Pass a `title` on the rare
 * occasion it carries meaning on its own.
 */
interface NairaSignProps {
  className?: string;
  /** Accessible name. Omit for decorative use — the icon is hidden instead. */
  title?: string;
}

export function NairaSign({ className, title }: NairaSignProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* The N: two stems and the diagonal between them. */}
      <path d="M5 4v16" />
      <path d="M19 4v16" />
      <path d="M5 4l14 16" />
      {/* The two crossbars that make it a currency mark rather than a letter.
          Drawn past the stems on both sides, as the glyph is. */}
      <path d="M3 9.5h18" />
      <path d="M3 14.5h18" />
    </svg>
  );
}
