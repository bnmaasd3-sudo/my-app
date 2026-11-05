import { ArrowLeft, ChevronLeft, ClipboardCheck, Feather, LibraryBig, Paperclip, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { typeAccent } from "@/lib/type-accent";
import { typeSubtitle, type BookKind, type LibraryBook } from "../library/library-view";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const KINDS: { kind: BookKind; icon: LucideIcon }[] = [
  { kind: "encyclopedia", icon: LibraryBig },
  { kind: "novel", icon: Feather },
  { kind: "appendix", icon: Paperclip },
];

/**
 * One personality type: its code, then a row for each of the reader's books
 * of that type (encyclopedia, novel, appendices; only those they own), then
 * the type test.
 */
export function TypeView({
  code,
  books,
  lang,
  dict,
}: {
  code: string;
  books: LibraryBook[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.type;
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5"
      style={{ "--type-accent": typeAccent(code) } as CSSProperties}
    >
      <SiteHeader lang={lang} dict={dict} path={`/type/${encodeURIComponent(code)}`} signedIn />
      <main className="flex flex-1 flex-col gap-10 py-10">
        <div className="flex flex-col gap-4">
          <Link
            href={`/${lang}/library`}
            className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft size={16} aria-hidden className="rtl:-scale-x-100" />
            {t.back}
          </Link>
          <div className="flex flex-col gap-1 border-s-4 border-(--type-accent) ps-4">
            <h1 className="font-heading text-4xl leading-tight font-bold tracking-wide">
              <bdi dir="ltr">{code}</bdi>
            </h1>
            <p className="text-muted">{typeSubtitle(code, dict)}</p>
          </div>
        </div>

        {KINDS.map(({ kind, icon }) => {
          const ofKind = books.filter((book) => book.kind === kind);
          if (ofKind.length === 0) return null;
          return (
            <Section key={kind} title={dict.library.kinds[kind]}>
              {ofKind.map((book) => (
                <Row
                  key={book.slug}
                  href={`/${lang}/read/${book.slug}/${book.position ?? 1}`}
                  icon={icon}
                  title={
                    <span lang={book.lang} dir={dir(book.lang)}>
                      {book.title}
                    </span>
                  }
                  meta={format(t.chapters, { n: book.chapters })}
                  action={book.position ? t.continue : t.start}
                  prefetch={false}
                />
              ))}
            </Section>
          );
        })}

        <Section title={t.test}>
          <Row
            href={`/${lang}/test`}
            icon={ClipboardCheck}
            title={dict.library.testTitle}
            meta={t.testLead}
            action={t.start}
          />
        </Section>
      </main>
      <SiteFooter lang={lang} dict={dict} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-sm font-semibold text-muted">{title}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

/** One big tappable row: an accent icon, the title and a quiet line under it, and what tapping does. */
function Row({
  href,
  icon: Icon,
  title,
  meta,
  action,
  prefetch,
}: {
  href: string;
  icon: LucideIcon;
  title: ReactNode;
  meta: string;
  action: string;
  prefetch?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={prefetch}
        className="flex items-center gap-4 rounded-2xl bg-surface px-5 py-5 transition-colors hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--type-accent)_14%,transparent)] text-(--type-accent)">
          <Icon size={22} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-heading leading-snug font-semibold">{title}</span>
          <span className="text-sm leading-relaxed text-muted">{meta}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
          {action}
          <ChevronLeft size={16} aria-hidden className="ltr:-scale-x-100" />
        </span>
      </Link>
    </li>
  );
}
