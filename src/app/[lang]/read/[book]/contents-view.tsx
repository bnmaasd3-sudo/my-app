import { BookOpen, ListOrdered } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "../../site-header";
import { ChapterList } from "../chapter-list";

export type Contents = {
  book: { slug: string; title: string; lang: string };
  chapters: { position: number; title: string }[];
  position: number | null;
};

/** The contents page around the chapter list. */
export function ContentsFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/library" signedIn />
      <main className="flex flex-1 flex-col gap-6 py-6">{children}</main>
    </div>
  );
}

/** A book's card and its numbered chapters, with the last position marked. */
export function ContentsView({ lang, dict, contents }: { lang: Locale; dict: Dictionary; contents: Contents }) {
  const bookLang = hasLocale(contents.book.lang) ? contents.book.lang : lang;
  const first = contents.position ?? 1;

  return (
    <>
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ListOrdered size={18} aria-hidden />
          </span>
          {dict.library.contents}
        </div>
        <h1 lang={bookLang} dir={dir(bookLang)} className="font-heading text-2xl leading-snug font-bold sm:text-3xl">
          {contents.book.title}
        </h1>
        <Link
          prefetch={false}
          href={`/${lang}/read/${contents.book.slug}/${first}`}
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground transition-opacity hover:opacity-90"
        >
          <BookOpen size={18} aria-hidden />
          {contents.position ? dict.library.continue : dict.library.start}
        </Link>
      </div>
      <ChapterList
        chapters={contents.chapters}
        base={`/${lang}/read/${contents.book.slug}`}
        bookLang={bookLang}
        lang={lang}
        marked={contents.position}
        badge={dict.reader.lastPosition}
        variant="page"
      />
    </>
  );
}
