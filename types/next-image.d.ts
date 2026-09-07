/**
 * Ambient module types for image imports (`import x from '@/public/images/x.png'`).
 *
 * Next.js normally supplies these via next-env.d.ts, which next dev/next
 * build generate on demand — which is also why it's gitignored rather than
 * committed. CI runs `tsc --noEmit` directly, with no prior dev/build step,
 * so that file never exists there and every image import fails typecheck
 * with "Cannot find module". This file is the same declaration, checked in
 * so typecheck works with no build step, in CI or a fresh clone alike.
 */
/// <reference types="next/image-types/global" />
