import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { BookMarkdown } from "./book-markdown";
import { ChapterList } from "./chapter-list";
import { isFontSize, isLayout, isTheme } from "@/lib/reader-prefs";
import { ReaderFrame } from "./reader-frame";
import { ReaderSignature } from "./reader-signature";

export type OpenedChapter = {
  book: { slug: string; title: string; lang: string };
  chapter: { position: number; title: string; body: string };
  total: number;
  scroll_ratio: number;
  reader: { name: string; email: string };
};

export type ReaderPrefs = { font_size?: string; theme?: string; layout?: string } | null;

/** The reading screen for one chapter. */
export function ChapterView({
  lang,
  dict,
  data,
  chapters,
  figures,
  prefs,
}: {
  lang: Locale;
  dict: Dictionary;
  data: OpenedChapter;
  chapters: { position: number; title: string }[];
  /** Signed URLs by figure file name. */
  figures: Record<string, string>;
  prefs: ReaderPrefs;
}) {
  const bookLang = hasLocale(data.book.lang) ? data.book.lang : lang;
  const base = `/${lang}/read/${data.book.slug}`;

  const previousHref = data.chapter.position > 1 ? `${base}/${data.chapter.position - 1}` : null;
  const nextHref = data.chapter.position < data.total ? `${base}/${data.chapter.position + 1}` : null;

  return (
    <ReaderFrame
      bookSlug={data.book.slug}
      bookLang={bookLang}
      bookDir={dir(bookLang)}
      chapterTitle={data.chapter.title}
      position={data.chapter.position}
      total={data.total}
      initialRatio={data.scroll_ratio}
      initialFontSize={isFontSize(prefs?.font_size) ? prefs.font_size : "md"}
      initialTheme={isTheme(prefs?.theme) ? prefs.theme : "system"}
      initialLayout={isLayout(prefs?.layout) ? prefs.layout : "auto"}
      labels={dict.reader}
      backHref={base}
      previousHref={previousHref}
      nextHref={nextHref}
      contents={
        <nav aria-label={dict.reader.contents}>
          <p lang={bookLang} dir={dir(bookLang)} className="mb-3 px-2.5 font-heading text-sm font-semibold">
            {data.book.title}
          </p>
          <ChapterList
            chapters={chapters}
            base={base}
            bookLang={bookLang}
            lang={lang}
            marked={data.chapter.position}
            badge={dict.reader.reading}
            variant="compact"
          />
        </nav>
      }
    >
      <article lang={bookLang} dir={dir(bookLang)} className="reader-text pt-10 pb-6 select-none">
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 font-heading text-sm text-accent">{data.book.title}</p>
          <h1 className="font-heading text-[1.45em] leading-snug font-bold">{data.chapter.title}</h1>
        </header>
        <BookMarkdown body={data.chapter.body} figures={figures} />
      </article>

      <nav className="grid grid-cols-2 gap-3 pb-10">
        {previousHref ? (
          <Link
            prefetch={false}
            href={previousHref}
            className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface"
          >
            <ChevronLeft size={18} aria-hidden className="shrink-0 rtl:-scale-x-100" />
            {dict.reader.previous}
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link
            prefetch={false}
            href={nextHref}
            className="flex items-center justify-end gap-2 rounded-2xl bg-accent px-4 py-3 font-heading text-accent-foreground transition-opacity hover:opacity-90"
          >
            {dict.reader.next}
            <ChevronRight size={18} aria-hidden className="shrink-0 rtl:-scale-x-100" />
          </Link>
        ) : (
          <span className="flex items-center justify-end rounded-2xl border border-dashed border-border px-4 py-3 text-muted">
            {dict.reader.endOfBook}
          </span>
        )}
      </nav>

      <ReaderSignature
        label={dict.reader.licensedTo}
        name={data.reader.name}
        email={data.reader.email}
      />
    </ReaderFrame>
  );
}
