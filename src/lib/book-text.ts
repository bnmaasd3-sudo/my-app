// Figures are written in the book as ![caption](الأشكال/name.png) and stored in
// the private "figures" bucket at "<book slug>/figures/name.png".

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?/g;

/** The file name a figure reference points to, or null if it has none. */
export function figureName(src: string | undefined | null): string | null {
  if (!src) return null;
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // Keep the raw value if it is not valid percent-encoding.
  }
  const name = decoded.split(/[\\/]/).pop()?.trim() ?? "";
  return /^[\w.\-]+\.(png|jpe?g|webp|gif|svg)$/i.test(name) ? name : null;
}

/** Storage paths of every figure a chapter body refers to. */
export function figurePaths(body: string, bookSlug: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(IMAGE)) {
    const name = figureName(match[1]);
    if (name) names.add(name);
  }
  return [...names].map((name) => `${bookSlug}/figures/${name}`);
}
