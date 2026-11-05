// The book-import rules the owner panel shares with scripts/import-book.mjs:
// one source of truth for how files become chapters and what a chapter may hold.
export {
  BOOK_KINDS,
  SUPPORT_LINE,
  checkBookMeta,
  checkChapters,
  countWords,
  digitLines,
  supportLineProblem,
  toChapters,
  withSupportLine,
} from "../../scripts/lib/book-import.mjs";

export type ImportedChapter = { position: number; title: string; body: string; source: string };

/** Largest chapter the panel accepts (characters); well above any chapter in the books. */
export const MAX_CHAPTER = 1_000_000;
/** Largest figure file the panel uploads (bytes), under the server action limit. */
export const MAX_FIGURE = 4 * 1024 * 1024;
/**
 * Figure file names the panel uploads: plain ASCII and a raster image. The
 * reader also shows SVG (figureName in book-text.ts), but an SVG can carry
 * script if its link is ever opened on its own, so the panel does not take one.
 */
export const FIGURE_NAME = /^[\w.\-]+\.(png|jpe?g|webp|gif)$/i;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function figureContentType(name: string) {
  return CONTENT_TYPES[name.split(".").pop()!.toLowerCase()];
}

/** The slug a type and kind suggest, e.g. INFJ-T-H + novel → infj-t-h-novel. */
export function suggestedSlug(typeCode: string, kind: string) {
  const type = typeCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return [type, kind].filter(Boolean).join("-");
}

/**
 * True when a Supabase error says books.active does not exist yet (migration
 * 20261105060000 not applied): Postgres answers 42703, PostgREST's schema cache
 * PGRST204 (write) or PGRST200/42703 (select).
 */
export function missingColumn(error: { code?: string; message?: string }) {
  return ["42703", "PGRST204", "PGRST200"].includes(error.code ?? "") || /\bactive\b/.test(error.message ?? "");
}
