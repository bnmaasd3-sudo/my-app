/**
 * A type's own accent, the same every time for the same code: a hue taken
 * from the code, at a fixed lightness and chroma that read in light and dark.
 */
export function typeHue(code: string) {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % 360;
}

export function typeAccent(code: string) {
  return `oklch(0.62 0.11 ${typeHue(code)})`;
}
