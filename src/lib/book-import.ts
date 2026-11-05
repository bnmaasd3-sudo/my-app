// The book-import rules the owner panel shares with scripts/import-book.mjs:
// one source of truth for how files become chapters and what a chapter may hold.
export {
  BOOK_KINDS,
  SUPPORT_LINE,
  checkBookMeta,
  checkChapters,
  countWords,
  supportLineProblem,
  toChapters,
  withSupportLine,
} from "../../scripts/lib/book-import.mjs";

export type ImportedChapter = { position: number; title: string; body: string; source: string };

/** Largest chapter the panel accepts (characters); well above any chapter in the books. */
export const MAX_CHAPTER = 1_000_000;
/** Largest figure file the panel uploads (bytes), under the server action limit. */
export const MAX_FIGURE = 4 * 1024 * 1024;
/** Figure file names the reader can show: plain ASCII, one of these image types. */
export const FIGURE_NAME = /^[\w.\-]+\.(png|jpe?g|webp|gif|svg)$/i;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export function figureContentType(name: string) {
  return CONTENT_TYPES[name.split(".").pop()!.toLowerCase()];
}

/** The slug a type and kind suggest, e.g. INFJ-T-H + novel → infj-t-h-novel. */
export function suggestedSlug(typeCode: string, kind: string) {
  const type = typeCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return [type, kind].filter(Boolean).join("-");
}
