import { Bookmark } from "lucide-react";
import Link from "next/link";
import { dir, type Locale } from "@/i18n/config";

type Props = {
  chapters: { position: number; title: string }[];
  /** e.g. /ar/read/infj-t-h-reader; each chapter links to `${base}/${position}`. */
  base: string;
  bookLang: Locale;
  /** Language of the interface, for the badge. */
  lang: Locale;
  /** The chapter that carries the badge, and the badge's text. */
  marked: number | null;
  badge: string;
  /** Larger cards for the contents page; compact rows beside the text. */
  variant: "page" | "compact";
};

/** The book's chapters, numbered, with the reader's place marked. */
export function ChapterList({ chapters, base, bookLang, lang, marked, badge, variant }: Props) {
  const page = variant === "page";

  return (
    <ol lang={bookLang} dir={dir(bookLang)} className={`flex flex-col ${page ? "gap-2" : "gap-0.5"}`}>
      {chapters.map((chapter) => {
        const current = chapter.position === marked;
        return (
          <li key={chapter.position}>
            <Link
              prefetch={false}
              href={`${base}/${chapter.position}`}
              aria-current={current ? "page" : undefined}
              className={
                page
                  ? "group flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent/50 aria-[current=page]:border-accent aria-[current=page]:bg-accent/5"
                  : "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-background aria-[current=page]:bg-accent/10"
              }
            >
              <span
                aria-hidden
                className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border font-heading tabular-nums text-muted group-aria-[current=page]:border-accent group-aria-[current=page]:bg-accent group-aria-[current=page]:text-accent-foreground ${page ? "size-9 text-sm" : "size-7 text-xs"}`}
              >
                {chapter.position}
              </span>
              <span className="min-w-0 flex-1 leading-relaxed group-aria-[current=page]:font-semibold">
                {chapter.title}
              </span>
              {current && (
                <span
                  lang={lang}
                  dir={dir(lang)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent"
                >
                  <Bookmark size={12} aria-hidden className="fill-current" />
                  {page && badge}
                  {!page && <span className="sr-only">{badge}</span>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
