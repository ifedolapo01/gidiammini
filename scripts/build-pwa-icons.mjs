// scripts/build-pwa-icons.mjs — the installed app's icons, from the shop's logo.
//
// The logo is 972x751; a launcher icon has to be square, so it is padded onto
// a square canvas rather than stretched. Run this again after replacing
// public/images/logo.png:
//
//   node scripts/build-pwa-icons.mjs
//
// Two purposes, two paddings. An "any" icon is shown as-is, so it uses the
// whole canvas; a "maskable" one is cropped to whatever shape the launcher
// prefers — a circle on most Android skins — so its artwork has to sit inside
// the middle 80%, the safe zone the spec guarantees. One icon serving both
// ends up either cramped everywhere or beheaded on a Pixel.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const SOURCE = 'public/images/logo.png';
const OUT_DIR = 'public/icons';

/** --primary in the storefront theme. Matches the manifest's theme_color, so
 *  the splash screen and the icon are the same pink. */
const BRAND = '#db2777';

/** White behind the logo: it is a dark wordmark, and on the brand pink it
 *  would be unreadable at 48px. The pink is the ring, not the field. */
const FIELD = '#ffffff';

const TARGETS = [
  { name: 'icon-192.png', size: 192, inset: 0.12, purpose: 'any' },
  { name: 'icon-512.png', size: 512, inset: 0.12, purpose: 'any' },
  // 20% in from every edge, so nothing is lost to a circular mask.
  { name: 'icon-maskable-512.png', size: 512, inset: 0.22, purpose: 'maskable' },
  // Apple has no maskable concept and puts its own rounded rect over it.
  { name: 'apple-touch-icon.png', size: 180, inset: 0.14, purpose: 'apple' },
];

await mkdir(OUT_DIR, { recursive: true });

/**
 * The mark, not the whole lockup.
 *
 * The logo is a footprint followed by "Gidiam Mini". Squeezed into a square it
 * leaves half the canvas empty and renders the wordmark at a size nobody can
 * read on a home screen — a launcher icon is looked at around 48px. So the
 * square is cut from the left of the trimmed artwork, which is the footprint:
 * the half of the logo that survives being small, and the half people
 * recognise on a crowded screen.
 *
 * The trim comes first because the source carries generous whitespace, and
 * cropping a padded image would cut the padding rather than the mark.
 */
const trimmed = await sharp(SOURCE).trim({ threshold: 10 }).toBuffer();
const { width = 0, height = 0 } = await sharp(trimmed).metadata();

/**
 * Where the mark ends.
 *
 * Guessing a fraction of the width leaves a sliver of the "G" in the corner,
 * which looks like a rendering fault rather than a design. Instead the gap is
 * measured: the columns are scanned for ink, and the cut is the first run of
 * blank ones wide enough to be the space between the footprint and the word.
 */
async function markWidth() {
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const inked = new Array(info.width).fill(false);
  for (let x = 0; x < info.width; x += 1) {
    for (let y = 0; y < info.height; y += 1) {
      const at = (y * info.width + x) * info.channels;
      const [r, g, b, a] = [data[at], data[at + 1], data[at + 2], data[at + 3]];
      // Ink is anything both opaque and not white.
      if (a > 24 && (r < 240 || g < 240 || b < 240)) {
        inked[x] = true;
        break;
      }
    }
  }

  // A gap has to be a real space, not the hole inside a letter.
  const minGap = Math.round(info.width * 0.02);
  let blank = 0;
  for (let x = 0; x < info.width; x += 1) {
    if (inked[x]) {
      if (blank >= minGap && x > minGap) return x - blank;
      blank = 0;
    } else {
      blank += 1;
    }
  }

  // No gap found: fall back to a square cut, which is what a logo with no
  // wordmark would want anyway.
  return Math.min(height, width);
}

const cut = await markWidth();
const mark = await sharp(trimmed)
  .extract({ left: 0, top: 0, width: cut, height })
  .toBuffer();

console.log(`Logo trimmed to ${width}x${height}; mark cut at ${cut}x${height}.
`);

for (const { name, size, inset, purpose } of TARGETS) {
  const artwork = Math.round(size * (1 - inset * 2));

  const logo = await sharp(mark)
    .resize(artwork, artwork, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // No transparency at the edges: a maskable icon is cropped to whatever shape
  // the launcher wants, and it has to fill the whole square first.
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: FIELD },
  });

  const composed = await canvas
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(join(OUT_DIR, name), composed);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(composed.length / 1024).toFixed(1)}KB  (${purpose})`);
}

console.log(`\nBrand colour ${BRAND} — keep app/manifest.ts's theme_color in step.`);
