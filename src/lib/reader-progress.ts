// How far a reader has got in a book, for the owner panel. Pure functions so
// the rules are tested on their own: chapters hidden for the reader do not
// count, and the place is the chapter of their saved reading state.

export type ChapterRef = { id: string; book_id: string; position: number; title: string };

export type BookProgress = {
  /** The reader's chapter among those they can open (1-based), or null if not started. */
  index: number | null;
  /** How many chapters this reader can open. */
  total: number;
  /** 0 to 100. */
  percent: number;
  /** Title of the chapter they are on, or null. */
  title: string | null;
};

export function bookProgress(
  chapters: ChapterRef[],
  hidden: ReadonlySet<string>,
  currentChapterId: string | null,
): BookProgress {
  const visible = chapters.filter((chapter) => !hidden.has(chapter.id)).sort((a, b) => a.position - b.position);
  const at = currentChapterId ? visible.findIndex((chapter) => chapter.id === currentChapterId) : -1;
  const index = at >= 0 ? at + 1 : null;
  return {
    index,
    total: visible.length,
    percent: index && visible.length ? Math.round((index / visible.length) * 100) : 0,
    title: at >= 0 ? visible[at].title : null,
  };
}

/** Whole days between a moment and now (0 = within the last day). */
export function daysAgo(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

/** The latest of several moments (ISO strings), ignoring empty ones. */
export function latest(...moments: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const moment of moments) {
    if (moment && (!best || new Date(moment).getTime() > new Date(best).getTime())) best = moment;
  }
  return best;
}

/** Whether a reader matches the owner's search (name or email, any case, ignoring spaces at the ends). */
export function matchesSearch(reader: { name: string | null; email: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return reader.email.toLowerCase().includes(q) || (reader.name ?? "").toLowerCase().includes(q);
}
