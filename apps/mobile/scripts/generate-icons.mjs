import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The brand mark, lifted verbatim from apps/mobile/src/components/locastar-logo.tsx
// so the launcher icon and the in-app logo can never drift apart.
const TEAL = '#125F6F';
const INK = '#F4F6F5';

const MARK_PATHS = [
  'M 49 48 L 49 566 L 261 566',
  'M 131 360 L 131 480 L 201 480',
  'M 466 332 A 182 192 0 1 0 163 325 L 313 568 L 418 412',
  'M 355 248 L 423 200 L 341 180 L 311 118 L 283 180 L 203 200 L 277 238 L 250 332 L 312 272 L 452 383 C 472 398 492 420 494 450 C 497 490 480 520 450 542 C 425 560 400 568 378 568',
];

/**
 * The mark drawn inside a 200x200 viewBox, scaled about its own centre.
 * `scale` lets each target respect its own safe area: Android's adaptive
 * icon only guarantees the middle 66% survives the launcher's mask.
 */
function mark({ scale = 1, stroke = INK }) {
  const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join('');
  return `<g transform="translate(100 100) scale(${scale}) translate(-100 -100)">
    <g transform="translate(23.86 13.94) scale(0.2794)" fill="none" stroke="${stroke}"
       stroke-width="24.5" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="6">
      ${paths}
    </g>
  </g>`;
}

function svg(body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${body}</svg>`
  );
}

// Full-bleed tile. iOS rejects alpha and applies its own corner mask, so the
// teal runs edge to edge rather than carrying the logo's own rounded corners.
const tile = svg(`<rect width="200" height="200" fill="${TEAL}"/>${mark({ scale: 0.88 })}`);

// Adaptive foreground: transparent, mark shrunk into the guaranteed-safe centre.
// 0.66 is measured, not guessed -- Android only promises the middle 72 of 108dp
// survives, and a circular launcher mask clipped 7% of the mark at 0.8.
const SAFE = 0.66;
const foreground = svg(mark({ scale: SAFE }));

// Monochrome: same geometry, pure white. Android keeps only the alpha and
// tints it to match the user's wallpaper.
const monochrome = svg(mark({ scale: SAFE, stroke: '#FFFFFF' }));

const background = svg(`<rect width="200" height="200" fill="${TEAL}"/>`);

// Splash: expo-splash-screen composites this over its own backgroundColor.
const splash = svg(mark({ scale: 0.88 }));

// Favicon keeps the logo's real rounded tile — browsers do not mask it.
const favicon = svg(
  `<rect x="4" y="4" width="192" height="192" rx="42" fill="${TEAL}"/>${mark({ scale: 0.88 })}`
);

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const jobs = [
  ['icon.png', tile, 1024],
  ['android-icon-foreground.png', foreground, 1024],
  ['android-icon-background.png', background, 1024],
  ['android-icon-monochrome.png', monochrome, 1024],
  ['splash-icon.png', splash, 1024],
  ['favicon.png', favicon, 196],
];

for (const [name, source, size] of jobs) {
  await sharp(source, { density: 900 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  console.log(`wrote ${name} (${size}x${size})`);
}
