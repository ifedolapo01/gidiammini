import type { NextConfig } from "next";

/**
 * The hostname product images actually come from.
 *
 * Derived from NEXT_PUBLIC_SUPABASE_URL rather than hardcoded, because the
 * project ref differs between the local, preview and production databases and a
 * hostname that is missing from this list does not degrade — next/image refuses
 * the URL outright and the image does not render at all.
 *
 * remotePatterns is an allowlist against someone pointing our optimiser at
 * arbitrary third-party images, so it stays narrow: this project's public
 * storage prefix only.
 */
function supabaseImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];

  try {
    return [
      {
        protocol: "https" as const,
        hostname: new URL(url).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    console.warn("NEXT_PUBLIC_SUPABASE_URL is not a valid URL; product images will not be optimised.");
    return [];
  }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // AVIF first, WebP second, original last. AVIF is roughly 20-30% smaller
    // than WebP again, which on a metered Nigerian mobile connection is the
    // difference this whole change is for. Browsers that support neither still
    // get the original via content negotiation.
    formats: ["image/avif", "image/webp"],
    // Optimised derivatives are immutable for a given source URL, and every
    // upload gets a fresh filename, so there is nothing to invalidate. The
    // default is 60 seconds, which re-fetches and re-encodes the same bytes all
    // day for no benefit.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      ...supabaseImagePattern(),
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
