import Link from "next/link";
import type { ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { InstallHint } from "./install-hint";

export type BookKind = "encyclopedia" | "novel" | "appendix";

export type LibraryBook = {
  slug: string;
  title: string;
  lang: Locale;
  position: number | null;
  /** Number of chapters this reader can open (the owner may hide some for them). */
  chapters: number;
  /** The first chapter this reader can open. */
  first?: number | null;
  /** The personality type the book belongs to, e.g. INFJ-T-H; null for other books. */
  type_code: string | null;
  kind: BookKind;
};

/** The one-word subtitle under a type's code, from the dictionary. */
export function typeSubtitle(code: string, dict: Dictionary) {
  const known = dict.library.typeSubtitles as Record<string, string>;
  return known[code] ?? dict.library.typeSubtitleDefault;
}

/** A tile: paper surface, no border or shadow; the whole tile is the tap target. */
export const tileClass =
  "block rounded-2xl bg-surface px-6 pt-7 pb-6 transition-colors hover:bg-[color-mix(in_oklab,var(--surface),var(--foreground)_4%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The thin accent rule under a tile's or a page's title. */
export function AccentRule() {
  return <span aria-hidden className="mt-5 block h-px w-12 bg-accent" />;
}

/** The library page: one headline, then the tiles. */
export function LibraryFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-8 pt-8 pb-14">
        <h1 className="font-heading text-2xl font-bold">{dict.library.title}</h1>
        {children}
        <InstallHint labels={dict.library.install} />
      </main>
      <SiteFooter lang={lang} dict={dict} path="/library" />
    </div>
  );
}

/**
 * The reader's library: a vertical stack of plain tiles, one per personality
 * type they own a book of. Everything about the type (its books and the test)
 * is on its own page. `books` is null when the owner is not a reader themselves.
 */
export function LibraryShelves({
  lang,
  dict,
  books,
  isAdmin,
}: {
  lang: Locale;
  dict: Dictionary;
  books: LibraryBook[] | null;
  isAdmin: boolean;
}) {
  const list = books ?? [];
  const types = [...new Set(list.map((book) => book.type_code).filter((code): code is string => Boolean(code)))];
  const others = list.filter((book) => !book.type_code);

  return (
    <>
      {books && list.length === 0 && <p className="text-muted">{dict.library.empty}</p>}

      {list.length > 0 && (
        <ul className="flex flex-col gap-3">
          {types.map((code) => (
            <li key={code}>
              <Link href={`/${lang}/type/${encodeURIComponent(code)}`} className={tileClass}>
                <span className="block font-heading text-5xl leading-none font-bold tracking-wide">
                  <bdi dir="ltr">{code}</bdi>
                </span>
                <AccentRule />
                <span className="mt-3 block text-sm text-muted">{typeSubtitle(code, dict)}</span>
              </Link>
            </li>
          ))}
          {/* A book with no type is a tile of its own, opening where the reader stopped. */}
          {others.map((book) => (
            <li key={book.slug}>
              <Link prefetch={false} href={`/${lang}/read/${book.slug}/${book.position ?? book.first ?? 1}`} className={tileClass}>
                <span lang={book.lang} dir={dir(book.lang)} className="block font-heading text-2xl leading-snug font-bold">
                  {book.title}
                </span>
                <AccentRule />
                <span className="mt-3 block text-sm text-muted">
                  {book.position ? dict.type.continue : dict.type.start}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* With no type to hold it, the test is reached from here. */}
      {types.length === 0 && (
        <Link href={`/${lang}/test`} className={tileClass}>
          <span className="block font-heading text-2xl leading-snug font-bold">{dict.library.testTitle}</span>
          <AccentRule />
          <span className="mt-3 block text-sm text-muted">{dict.type.testLead}</span>
        </Link>
      )}

      {isAdmin && (
        <Link href={`/${lang}/admin`} className="self-start text-sm text-accent hover:underline">
          {dict.admin.open}
        </Link>
      )}
    </>
  );
}
