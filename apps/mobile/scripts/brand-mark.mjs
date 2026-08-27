// The brand mark, as SVG, for anything that has to render it outside the app.
//
// Lifted verbatim from apps/mobile/src/components/locastar-logo.tsx. It lives
// in its own module because there are now two generators that need it — the
// launcher icons and the email logo — and the previous arrangement kept a
// second copy of MARK_PATHS inside generate-icons.mjs, which is exactly the
// drift this file exists to prevent. Import it; never paste it.

export const TEAL = '#125F6F';
export const INK = '#F4F6F5';

export const MARK_PATHS = [
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
export function mark({ scale = 1, stroke = INK } = {}) {
  const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join('');
  return `<g transform="translate(100 100) scale(${scale}) translate(-100 -100)">
    <g transform="translate(23.86 13.94) scale(0.2794)" fill="none" stroke="${stroke}"
       stroke-width="24.5" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="6">
      ${paths}
    </g>
  </g>`;
}

export function svg(body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${body}</svg>`
  );
}
