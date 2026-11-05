import { ClipboardCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { typeAccent } from "@/lib/type-accent";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

export type BookKind = "encyclopedia" | "novel" | "appendix";

export type LibraryBook = {
  slug: string;
  title: string;
  lang: Locale;
  position: number | null;
  /** Number of chapters in the book. */
  chapters: number;
  /** The personality type the book belongs to, e.g. INFJ-T-H; null for other books. */
  type_code: string | null;
  kind: BookKind;
};

/** The one-word subtitle under a type's code, from the dictionary. */
export function typeSubtitle(code: string, dict: Dictionary) {
  const known = dict.library.typeSubtitles as Record<string, string>;
  return known[code] ?? dict.library.typeSubtitleDefault;
}

/** The library page around its tiles. */
export function LibraryFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/library" signedIn />
      <main className="flex flex-1 flex-col gap-10 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold">{dict.library.title}</h1>
          <p className="leading-relaxed text-muted">{dict.library.lead}</p>
        </div>
        {children}
      </main>
      <SiteFooter lang={lang} dict={dict} />
    </div>
  );
}

/**
 * The reader's library: one plain tile per personality type they own a book
 * of. Everything about the type (its books and the test) is on its own page.
 * `books` is null when the owner is not a reader themselves.
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
      {isAdmin && (
        <Link
          href={`/${lang}/admin`}
          className="inline-flex items-center gap-2 self-start rounded-2xl px-1 py-1 text-sm text-accent hover:underline"
        >
          <ShieldCheck size={16} aria-hidden />
          {dict.admin.open}
        </Link>
      )}

      {books && list.length === 0 && <p className="leading-relaxed text-muted">{dict.library.empty}</p>}

      {types.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((code) => (
            <li key={code}>
              <TypeTile code={code} lang={lang} dict={dict} />
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <section aria-labelledby="other-books" className="flex flex-col gap-3">
          <h2 id="other-books" className="font-heading text-base font-semibold text-muted">
            {dict.library.otherBooks}
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((book) => (
              <li key={book.slug}>
                <Link
                  prefetch={false}
                  href={`/${lang}/read/${book.slug}/${book.position ?? 1}`}
                  className="block rounded-2xl bg-surface px-5 py-4 transition-colors hover:bg-accent/5"
                >
                  <span lang={book.lang} dir={dir(book.lang)} className="font-heading font-semibold">
                    {book.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* With no type to hold it, the test is reached from here. */}
      {types.length === 0 && (
        <Link
          href={`/${lang}/test`}
          className="flex items-center gap-4 rounded-2xl bg-surface px-5 py-5 transition-colors hover:bg-accent/5"
        >
          <ClipboardCheck size={22} aria-hidden className="shrink-0 text-accent" />
          <span className="font-heading font-semibold">{dict.library.testTitle}</span>
        </Link>
      )}
    </>
  );
}

/** A type as a plain tile: its code, a one-word subtitle and its own accent line. */
function TypeTile({ code, lang, dict }: { code: string; lang: Locale; dict: Dictionary }) {
  return (
    <Link
      href={`/${lang}/type/${encodeURIComponent(code)}`}
      style={{ "--type-accent": typeAccent(code) } as CSSProperties}
      className="flex min-h-40 flex-col justify-between gap-6 rounded-3xl bg-surface px-6 py-6 transition-colors hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-(--type-accent)" />
      <span className="flex flex-col gap-1">
        <span className="font-heading text-4xl leading-tight font-bold tracking-wide">
          <bdi dir="ltr">{code}</bdi>
        </span>
        <span className="text-sm text-muted">{typeSubtitle(code, dict)}</span>
      </span>
    </Link>
  );
}
