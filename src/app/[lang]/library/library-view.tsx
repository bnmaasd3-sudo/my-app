import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Feather,
  LibraryBig,
  ListOrdered,
  Paperclip,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { SiteHeader } from "../site-header";

export type BookKind = "encyclopedia" | "novel" | "appendix";

export type LibraryBook = {
  slug: string;
  title: string;
  lang: Locale;
  position: number | null;
  /** The personality type the book belongs to, e.g. INFJ-T-H; null for other books. */
  type_code: string | null;
  kind: BookKind;
};

const KINDS: { kind: BookKind; icon: LucideIcon }[] = [
  { kind: "encyclopedia", icon: LibraryBig },
  { kind: "novel", icon: Feather },
  { kind: "appendix", icon: Paperclip },
];

/** The reader's books by type, in the order the database gave them (encyclopedia, novel, appendices). */
function byType(books: LibraryBook[]) {
  const types = new Map<string, LibraryBook[]>();
  const others: LibraryBook[] = [];
  for (const book of books) {
    if (!book.type_code) others.push(book);
    else types.set(book.type_code, [...(types.get(book.type_code) ?? []), book]);
  }
  return { types: [...types.entries()], others };
}

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
 * The reader's books: one card per personality type they own something of,
 * with its encyclopedia, novel and appendices (only the parts they own) and
 * the type test; then any other books. `books` is null when the owner is not
 * a reader themselves: then the books are left out.
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

  const { types, others } = byType(books ?? []);

  return (
    <>
      {ownerLink}

      {books && books.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-5 leading-relaxed text-muted">
          {dict.library.empty}
        </p>
      )}

      {types.map(([typeCode, typeBooks]) => (
        <TypeCard key={typeCode} typeCode={typeCode} books={typeBooks} lang={lang} dict={dict} />
      ))}

      {others.length > 0 && (
        <section aria-labelledby="books-title" className="flex flex-col gap-4">
          <h2 id="books-title" className="font-heading text-lg font-semibold">
            {types.length > 0 ? dict.library.otherBooks : dict.library.books}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {others.map((book) => (
              <li key={book.slug}>
                <BookCard book={book} lang={lang} dict={dict} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Each type's card has the test; without one, it stands on its own. */}
      {types.length === 0 && (
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
      )}
    </>
  );
}

function TypeCard({
  typeCode,
  books,
  lang,
  dict,
}: {
  typeCode: string;
  books: LibraryBook[];
  lang: Locale;
  dict: Dictionary;
}) {
  const titleId = `type-${typeCode}`;
  return (
    <article aria-labelledby={titleId} className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <header className="flex items-center gap-4 bg-linear-to-br from-accent/20 via-accent/10 to-transparent p-5">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Sparkles size={22} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted">{dict.library.typeLabel}</span>
          <h2 id={titleId} className="font-heading text-2xl font-bold tracking-wide">
            <bdi dir="ltr">{typeCode}</bdi>
          </h2>
          <span className="text-sm text-muted">{dict.library.typeLead}</span>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {KINDS.map(({ kind, icon: Icon }) => {
          const ofKind = books.filter((book) => book.kind === kind);
          if (ofKind.length === 0) return null;
          return (
            <section key={kind} className="flex flex-col gap-3 p-5">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-muted">
                <Icon size={16} aria-hidden className="text-accent" />
                {dict.library.kinds[kind]}
              </h3>
              <ul className="flex flex-col gap-3">
                {ofKind.map((book) => (
                  <li key={book.slug}>
                    <BookRow book={book} lang={lang} dict={dict} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ClipboardCheck size={20} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col">
              <h3 className="font-heading font-semibold">{dict.library.testTitle}</h3>
              <p className="text-sm leading-relaxed text-muted">{dict.library.testLead}</p>
            </div>
          </div>
          <Link
            href={`/${lang}/test`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-background"
          >
            {dict.library.testOpen}
            <ArrowLeft size={16} aria-hidden className="ltr:-scale-x-100" />
          </Link>
        </section>
      </div>
    </article>
  );
}

/** One book inside a type card: its title, how far the reader got, and the way in. */
function BookRow({ book, lang, dict }: { book: LibraryBook; lang: Locale; dict: Dictionary }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h4 lang={book.lang} dir={dir(book.lang)} className="font-heading leading-snug font-semibold">
          {book.title}
        </h4>
        <p className="text-sm text-muted">
          {book.position ? format(dict.library.reachedChapter, { n: book.position }) : dict.library.notStarted}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          prefetch={false}
          href={`/${lang}/read/${book.slug}/${book.position ?? 1}`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-heading text-sm text-accent-foreground transition-opacity hover:opacity-90"
        >
          <BookOpen size={16} aria-hidden />
          {book.position ? dict.library.continue : dict.library.start}
        </Link>
        <Link
          href={`/${lang}/read/${book.slug}`}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-surface"
        >
          <ListOrdered size={16} aria-hidden />
          {dict.library.contents}
        </Link>
      </div>
    </div>
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
