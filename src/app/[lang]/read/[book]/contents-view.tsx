import Link from "next/link";
import type { ReactNode } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "../../site-footer";
import { SiteHeader } from "../../site-header";
import { ChapterList } from "../chapter-list";

export type Contents = {
  book: { slug: string; title: string; lang: string };
  chapters: { position: number; title: string }[];
  position: number | null;
  /** The first chapter this reader can open. */
  first?: number | null;
};

/** The contents page around the chapter list. */
export function ContentsFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-8 pt-8 pb-14">{children}</main>
      <SiteFooter lang={lang} dict={dict} path="/library" />
    </div>
  );
}

/** A book's card and its numbered chapters, with the last position marked. */
export function ContentsView({ lang, dict, contents }: { lang: Locale; dict: Dictionary; contents: Contents }) {
  const bookLang = hasLocale(contents.book.lang) ? contents.book.lang : lang;
  const first = contents.position ?? contents.first ?? 1;

  return (
    <>
      <div className="flex flex-col items-start gap-5">
        <p className="text-sm text-muted">{dict.library.contents}</p>
        <h1 lang={bookLang} dir={dir(bookLang)} className="font-heading text-2xl leading-snug font-bold">
          {contents.book.title}
        </h1>
        <Link
          prefetch={false}
          href={`/${lang}/read/${contents.book.slug}/${first}`}
          className="rounded-xl bg-accent px-6 py-3 font-heading text-accent-foreground transition-opacity hover:opacity-90"
        >
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
