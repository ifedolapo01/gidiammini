/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * The first thing in the tab order on every page. Visually hidden until it
 * takes focus, then it pins itself to the top-left as a normal-looking link.
 *
 * Both layers mount one, because both put a lot between the top of the
 * document and the content: the storefront has a logo, a nav, a search box and
 * four icon links; the admin has a sidebar of a dozen sections. Without this a
 * keyboard user pays for all of that on every single navigation.
 *
 * The target must be focusable for the jump to move focus and not just scroll
 * — give it `tabIndex={-1}`. See the `<main>` in either layout.
 */
interface SkipLinkProps {
  /** Element id to jump to. Defaults to the shared main-content id. */
  targetId?: string;
  children?: React.ReactNode;
}

/** The id both layouts put on their <main>. */
export const MAIN_CONTENT_ID = 'main-content';

export function SkipLink({ targetId = MAIN_CONTENT_ID, children = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={
        // sr-only until focused, then a real, visible control. `focus:` rather
        // than `focus-visible:`: this link is only ever reached by keyboard,
        // so there is no mouse-focus case to suppress.
        'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] ' +
        'focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 ' +
        'focus:text-body-sm focus:font-medium focus:text-text-primary ' +
        'focus:shadow-elevation-3 focus:outline-none focus:ring-2 focus:ring-focus'
      }
    >
      {children}
    </a>
  );
}
