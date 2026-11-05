/**
 * A type's own accent, the same every time for the same code. The hue comes
 * from a fixed palette of well-separated hues (no pale yellows), at a
 * lightness that keeps icons readable on light and dark surfaces.
 */
const HUES = [250, 30, 160, 320, 200, 0, 290, 60];

export function typeHue(code: string) {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return HUES[hash % HUES.length];
}

export function typeAccent(code: string) {
  return `oklch(0.58 0.12 ${typeHue(code)})`;
}
