import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { currentLocale } from "@/i18n/locale";
import { SiteFooter } from "../../../site-footer";
import { SiteHeader } from "../../../site-header";
import { ProgressLine } from "../../progress-line";
import { loadReaderDetail, ownerService, type ReaderDetail } from "../../reader-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.follow.open };
}

/** One reader, for the owner: their account, where they are in each book, and what they read lately. */
export default async function AdminReaderPage({ params }: PageProps<"/[lang]/admin/readers/[id]">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-10 pt-6 pb-14">
        <Link href={`/${lang}/admin`} className="self-start text-sm text-muted hover:text-foreground">
          {dict.admin.follow.back}
        </Link>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Reader params={params} lang={lang} dict={dict} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} path="/admin" />
    </div>
  );
}

async function Reader({
  params,
  lang,
  dict,
}: {
  params: Promise<{ id: string }>;
  lang: Locale;
  dict: Dictionary;
}) {
  const { id } = await params;
  const owner = await ownerService();
  if ("error" in owner && owner.error === "notOwner") notFound();
  const t = dict.admin.follow;
  if ("error" in owner) return <p className="text-accent">{t.noServiceKey}</p>;
  if (!UUID.test(id)) notFound();
  const detail = await loadReaderDetail(owner.service, id);
  if (!detail) return <p className="text-muted">{t.notFound}</p>;
  return <ReaderView detail={detail} lang={lang} dict={dict} />;
}

function ReaderView({ detail, lang, dict }: { detail: ReaderDetail; lang: Locale; dict: Dictionary }) {
  const t = dict.admin.follow;
  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  });
  const date = (iso: string) => when.format(new Date(iso));
  const { reader } = detail;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold">{reader.name || reader.email}</h1>
        <p dir="ltr" className="text-start text-sm text-muted">
          {reader.email}
        </p>
        <p className="text-sm text-muted">
          <span className={reader.active ? "text-accent" : ""}>
            {reader.active ? dict.admin.active : dict.admin.suspended}
          </span>
          {" · "}
          {detail.lastSignIn ? `${t.signIn} ${date(detail.lastSignIn)}` : t.neverSignedIn}
          {" · "}
          {t.joined} {date(reader.createdAt)}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.books}</h2>
        {detail.books.length === 0 ? (
          <p className="text-muted">{t.noBooks}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {detail.books.map((book) => {
              const bookLang = hasLocale(book.lang) ? book.lang : lang;
              return (
                <li key={book.slug} className="flex flex-col gap-2 py-4">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span lang={bookLang} dir={dir(bookLang)} className="font-heading font-semibold">
                      {book.title}
                    </span>
                    {!book.active && <span className="text-xs text-muted">{t.unlinked}</span>}
                  </p>
                  {book.progress.title && (
                    <p className="text-sm">
                      <span className="text-muted">{t.current}: </span>
                      <span lang={bookLang} dir={dir(bookLang)}>
                        {book.progress.title}
                      </span>
                      <span className="text-muted"> · {book.progress.percent}%</span>
                    </p>
                  )}
                  <ProgressLine progress={book.progress} updatedAt={book.progress.updatedAt} labels={t} />
                  <p className="text-xs text-muted">
                    {format(t.opened, { n: book.opened, total: book.progress.total })}
                    {book.firstOpened && ` · ${t.firstOpened} ${date(book.firstOpened)}`}
                    {book.lastOpened && ` · ${t.lastOpened} ${date(book.lastOpened)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.timeline}</h2>
        {detail.timeline.length === 0 ? (
          <p className="text-muted">{t.noTimeline}</p>
        ) : (
          <ol className="divide-y divide-border border-y border-border text-sm">
            {detail.timeline.map((row, index) => (
              <li key={`${row.at}-${index}`} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="w-40 shrink-0 text-xs text-muted tabular-nums">{date(row.at)}</span>
                <span className="text-muted">{row.book}</span>
                <span dir="auto">{row.chapter}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.devices}</h2>
        {detail.devices.length === 0 ? (
          <p className="text-muted">{t.noDevices}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border text-sm">
            {detail.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <code dir="ltr" className="text-xs">
                  {device.id.slice(0, 8)}
                </code>
                <span className="text-muted">{date(device.lastSeen)}</span>
                {device.revoked && <span className="text-muted">{t.revoked}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.tests}</h2>
        {detail.tests.length === 0 ? (
          <p className="text-muted">{t.noTests}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border text-sm">
            {detail.tests.map((test) => (
              <li key={test.key} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span>{test.name || "—"}</span>
                <span className="text-muted">
                  {test.status && test.status in dict.admin.testStatus
                    ? dict.admin.testStatus[test.status as keyof typeof dict.admin.testStatus]
                    : (test.status ?? "")}
                </span>
                <span className="text-xs text-muted">{date(test.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${lang}/admin/test`} className="self-start text-sm text-accent hover:underline">
          {t.testsLink}
        </Link>
      </section>
    </>
  );
}
