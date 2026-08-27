import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { TEAL, mark, svg } from './brand-mark.mjs';

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
