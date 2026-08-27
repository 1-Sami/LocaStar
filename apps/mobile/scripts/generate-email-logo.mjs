import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { TEAL, mark, svg } from './brand-mark.mjs';

// The logo as it appears in transactional email. Same mark as the launcher
// icon, but the constraints are a mail client's, not a launcher's:
//
// Opaque, never transparent. The mark is stroked in ink (#F4F6F5), so on a
// transparent background it disappears against the white card in light mode —
// and a teal-stroked variant would disappear against the same card once Apple
// Mail or Outlook.com inverts it. Clients composite transparency onto a
// background we do not control, so the tile carries its own.
//
// Square, not rounded. The rounding is applied in CSS by the template, so
// clients that support border-radius round it and Outlook simply shows a
// square. Baking the corners in would mean baking in a background colour
// behind them, which shows up as white notches the moment a client inverts.
//
// Rendered at 2x its display size for retina, and versioned in the filename:
// mail clients and Gmail's image proxy cache indefinitely and cannot be
// purged, so a new filename is the only cache-busting mechanism there is.

const tile = svg(`<rect width="200" height="200" fill="${TEAL}"/>${mark({ scale: 0.88 })}`);

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node generate-email-logo.mjs <output-dir>');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const jobs = [['logo-v1.png', tile, 128]];

for (const [name, source, size] of jobs) {
  await sharp(source, { density: 900 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  console.log(`wrote ${name} (${size}x${size})`);
}
