import { ArrowLeft, BookOpen, ClipboardCheck, ListOrdered, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { SiteHeader } from "../site-header";

export type LibraryBook = {
  slug: string;
  title: string;
  lang: Locale;
  position: number | null;
};

/** The library page around its shelves. */
export function LibraryFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/library" signedIn />
      <main className="flex flex-1 flex-col gap-8 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold">{dict.library.title}</h1>
          <p className="text-muted">{dict.library.lead}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

/**
 * The reader's books and the tests. `books` is null when the owner is not a
 * reader themselves: then the books shelf is left out.
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
  const ownerLink = isAdmin && (
    <Link
      href={`/${lang}/admin`}
      className="inline-flex items-center gap-2 self-start rounded-full border border-accent px-5 py-2.5 font-heading text-accent transition-colors hover:bg-accent/10"
    >
      <ShieldCheck size={18} aria-hidden />
      {dict.admin.open}
    </Link>
  );

  return (
    <>
      {ownerLink}

      {books && (
        <section aria-labelledby="books-title" className="flex flex-col gap-4">
          <h2 id="books-title" className="font-heading text-lg font-semibold">
            {dict.library.books}
          </h2>
          {books.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {books.map((book) => (
                <li key={book.slug}>
                  <BookCard book={book} lang={lang} dict={dict} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-5 leading-relaxed text-muted">
              {dict.library.empty}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="tests-title" className="flex flex-col gap-4">
        <h2 id="tests-title" className="font-heading text-lg font-semibold">
          {dict.library.tools}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <TestCard lang={lang} dict={dict} />
          </li>
        </ul>
      </section>
    </>
  );
}

function Cover({ icon }: { icon: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-28 items-center justify-center bg-linear-to-br from-accent/20 via-accent/10 to-transparent text-accent"
    >
      {icon}
    </div>
  );
}

const cardClass =
  "flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md";

function BookCard({ book, lang, dict }: { book: LibraryBook; lang: Locale; dict: Dictionary }) {
  return (
    <article className={cardClass}>
      <Cover icon={<BookOpen size={40} strokeWidth={1.5} />} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 lang={book.lang} dir={dir(book.lang)} className="font-heading text-lg leading-snug font-semibold">
            {book.title}
          </h3>
          <p className="text-sm text-muted">
            {book.position
              ? format(dict.library.reachedChapter, { n: book.position })
              : dict.library.notStarted}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            prefetch={false}
            href={`/${lang}/read/${book.slug}/${book.position ?? 1}`}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 font-heading text-sm text-accent-foreground transition-opacity hover:opacity-90"
          >
            <BookOpen size={16} aria-hidden />
            {book.position ? dict.library.continue : dict.library.start}
          </Link>
          <Link
            href={`/${lang}/read/${book.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm transition-colors hover:bg-background"
          >
            <ListOrdered size={16} aria-hidden />
            {dict.library.contents}
          </Link>
        </div>
      </div>
    </article>
  );
}

function TestCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <article className={cardClass}>
      <Cover icon={<ClipboardCheck size={40} strokeWidth={1.5} />} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-lg leading-snug font-semibold">{dict.library.testTitle}</h3>
          <p className="text-sm leading-relaxed text-muted">{dict.library.testLead}</p>
        </div>
        <Link
          href={`/${lang}/test`}
          className="mt-auto inline-flex items-center gap-2 self-start rounded-full bg-accent px-4 py-2.5 font-heading text-sm text-accent-foreground transition-opacity hover:opacity-90"
        >
          {dict.library.testOpen}
          <ArrowLeft size={16} aria-hidden className="ltr:-scale-x-100" />
        </Link>
      </div>
    </article>
  );
}
