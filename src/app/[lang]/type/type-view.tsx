import Link from "next/link";
import type { ReactNode } from "react";
import { dir, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { AccentRule, typeSubtitle, type BookKind, type LibraryBook } from "../library/library-view";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const KINDS: BookKind[] = ["encyclopedia", "novel", "appendix"];

/**
 * One personality type: its code as the hero, then plain rows separated by
 * hairlines: the encyclopedia, the novel and the appendices (only those the
 * reader owns), then the type test. Each row is the whole-width tap target.
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
  const rows = KINDS.flatMap((kind) => {
    const ofKind = books.filter((book) => book.kind === kind);
    return ofKind.map((book) => ({
      key: book.slug,
      href: `/${lang}/read/${book.slug}/${book.position ?? 1}`,
      // A second book of the same kind is told apart by its own title.
      title: ofKind.length > 1 ? book.title : dict.library.kinds[kind],
      titleLang: ofKind.length > 1 ? book.lang : lang,
      detail: book.position ? t.continue : format(t.chapters, { n: book.chapters }),
    }));
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-10 pt-6 pb-14">
        <Link href={`/${lang}/library`} className="self-start text-sm text-muted hover:text-foreground">
          {t.back}
        </Link>
        <header>
          <h1 className="font-heading text-5xl leading-none font-bold tracking-wide">
            <bdi dir="ltr">{code}</bdi>
          </h1>
          <AccentRule />
          <p className="mt-3 text-sm text-muted">{typeSubtitle(code, dict)}</p>
        </header>

        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <Row key={row.key} href={row.href} prefetch={false} detail={row.detail}>
              <span lang={row.titleLang} dir={dir(row.titleLang)}>
                {row.title}
              </span>
            </Row>
          ))}
          <Row href={`/${lang}/test`} detail={t.testLead}>
            {t.test}
          </Row>
        </ul>
      </main>
      <SiteFooter lang={lang} dict={dict} path={`/type/${encodeURIComponent(code)}`} />
    </div>
  );
}

/** One row: the title and a quiet line under it. */
function Row({
  href,
  detail,
  prefetch,
  children,
}: {
  href: string;
  detail: string;
  prefetch?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={prefetch}
        className="flex flex-col gap-0.5 py-5 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="font-heading text-lg leading-snug font-semibold">{children}</span>
        <span className="text-sm text-muted">{detail}</span>
      </Link>
    </li>
  );
}
