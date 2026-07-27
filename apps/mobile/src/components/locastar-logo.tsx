import Svg, { G, Path, Rect } from 'react-native-svg';

/** The LocaStar brand mark — teal rounded tile with the "L" + star/pin lockup. */
export function LocaStarLogo({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Rect x={4} y={4} width={192} height={192} rx={42} fill="#125F6F" />
      <G
        transform="translate(23.86 13.94) scale(0.2794)"
        fill="none"
        stroke="#F4F6F5"
        strokeWidth={24.5}
        strokeLinecap="round"
        strokeLinejoin="miter"
        strokeMiterlimit={6}>
        <Path d="M 49 48 L 49 566 L 261 566" />
        <Path d="M 131 360 L 131 480 L 201 480" />
        <Path d="M 466 332 A 182 192 0 1 0 163 325 L 313 568 L 418 412" />
        <Path d="M 355 248 L 423 200 L 341 180 L 311 118 L 283 180 L 203 200 L 277 238 L 250 332 L 312 272 L 452 383 C 472 398 492 420 494 450 C 497 490 480 520 450 542 C 425 560 400 568 378 568" />
      </G>
    </Svg>
  );
}
