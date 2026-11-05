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
  /** Plain rows between hairlines on the contents page; compact rows beside the text. */
  variant: "page" | "compact";
};

/** The book's chapters, numbered, with the reader's place marked. */
export function ChapterList({ chapters, base, bookLang, lang, marked, badge, variant }: Props) {
  const page = variant === "page";

  return (
    <ol
      lang={bookLang}
      dir={dir(bookLang)}
      className={page ? "flex flex-col divide-y divide-border border-y border-border" : "flex flex-col gap-0.5"}
    >
      {/* Numbered in order, so chapters hidden for this reader leave no gap. */}
      {chapters.map((chapter, index) => {
        const current = chapter.position === marked;
        return (
          <li key={chapter.position}>
            <Link
              prefetch={false}
              href={`${base}/${chapter.position}`}
              aria-current={current ? "page" : undefined}
              className={
                page
                  ? "group flex items-baseline gap-4 py-4 transition-colors hover:text-accent aria-[current=page]:text-accent"
                  : "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-background aria-[current=page]:bg-accent/10"
              }
            >
              {page ? (
                <span aria-hidden className="w-7 shrink-0 font-heading text-sm tabular-nums text-muted group-aria-[current=page]:text-accent">
                  {index + 1}
                </span>
              ) : (
                <span
                  aria-hidden
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-heading text-xs tabular-nums text-muted group-aria-[current=page]:border-accent group-aria-[current=page]:bg-accent group-aria-[current=page]:text-accent-foreground"
                >
                  {index + 1}
                </span>
              )}
              <span className="min-w-0 flex-1 group-aria-[current=page]:font-semibold">{chapter.title}</span>
              {current &&
                (page ? (
                  // Where the reader stopped, as quiet text.
                  <span lang={lang} dir={dir(lang)} className="shrink-0 text-sm">
                    {badge}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center text-accent">
                    <Bookmark size={12} aria-hidden className="fill-current" />
                    <span className="sr-only">{badge}</span>
                  </span>
                ))}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
