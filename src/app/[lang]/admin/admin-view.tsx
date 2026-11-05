import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { revokeDevice, setEntitlement, setReaderActive, setSallaProduct } from "./actions";
import { AddReaderForm } from "./add-reader-form";
import { ChapterOverrides } from "./chapter-overrides";
import { ProgressLine } from "./progress-line";
import type { ProgressByReader } from "./reader-data";
import { ResendWelcome } from "./resend-welcome";

export type Dashboard = {
  books: { slug: string; title: string; chapters: number; readers: number }[];
  readers: {
    id: string;
    email: string;
    name: string | null;
    active: boolean;
    created_at: string;
    books: {
      slug: string;
      title: string;
      active: boolean;
      source: string;
      /** Chapters hidden for this reader, and chapters with their own text (from 20261105023000). */
      hidden?: number;
      replaced?: number;
    }[];
    devices: { id: string; last_seen: string; revoked: boolean }[];
    last_read_at: string | null;
    /** From Supabase Auth; missing until the 20261104010000 migration is applied. */
    last_sign_in_at?: string | null;
  }[];
  /** Invited emails that have not signed in yet; missing before that migration. */
  invites?: { email: string; name: string | null; created_at: string; books: string[] }[];
  reads: { email: string; book: string; chapter: string; opened_at: string }[];
};

export type SallaPanel = {
  products: { sku: string; book: string; title: string }[];
  events: {
    received_at: string;
    event: string;
    order_id: string | null;
    status: string | null;
    email: string | null;
    outcome: string;
  }[];
};

export type TestResultRow = {
  key: string;
  user_id: string | null;
  status: string | null;
  name: string | null;
  updated_at: string;
};

const smallButton = "rounded-full border border-border px-3 py-1 text-xs hover:bg-background";

type Props = {
  data: Dashboard;
  /** Where each reader is in each book (null when the service key is not set). */
  progress: ProgressByReader | null;
  /** The owner's search, already applied to data.readers. */
  query: string;
  salla: SallaPanel;
  tests: TestResultRow[];
  webhookUrl: string;
  lang: Locale;
  dict: Dictionary;
};

export function AdminView({ data, progress, query, salla, tests, webhookUrl, lang, dict }: Props) {
  const { books, readers, reads } = data;

  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  });
  const t = dict.admin;

  return (
    <>
      <AddReaderForm books={books} lang={lang} dict={t} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-semibold">{t.books}</h2>
          <Link href={`/${lang}/admin/books`} className="text-sm text-accent hover:underline">
            {t.bookImport.open}
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {books.map((book) => (
            <li key={book.slug} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="font-heading">{book.title}</p>
              <p className="text-sm text-muted" dir="ltr">
                {book.slug} · {format(t.chaptersCount, { n: book.chapters })} ·{" "}
                {format(t.readersCount, { n: book.readers })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.readers}</h2>
        <form method="get" className="flex flex-wrap items-center gap-2" role="search">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t.follow.search}
            aria-label={t.follow.search}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button className={smallButton}>{t.follow.searchButton}</button>
          {query && (
            <Link href={`/${lang}/admin`} className="text-xs text-muted hover:text-foreground">
              {t.follow.clear}
            </Link>
          )}
        </form>
        <p className="text-xs text-muted">{t.follow.sortedBy}</p>
        {progress === null && <p className="text-xs text-muted">{t.follow.noServiceKey}</p>}
        {readers.length === 0 && <p className="text-muted">{query ? t.follow.noMatch : t.noReaders}</p>}
        <ul className="flex flex-col gap-3">
          {readers.map((reader) => (
            <li key={reader.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/${lang}/admin/readers/${reader.id}`} className="font-heading hover:text-accent">
                    {reader.name || reader.email}
                  </Link>
                  <p className="text-sm text-muted" dir="ltr">
                    {reader.email}
                  </p>
                  {"last_sign_in_at" in reader && (
                    <p className="text-xs text-muted">
                      {reader.last_sign_in_at
                        ? `${t.lastSignIn} ${when.format(new Date(reader.last_sign_in_at))}`
                        : t.neverSignedIn}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={reader.active ? "text-sm text-accent" : "text-sm text-muted"}>
                    {reader.active ? t.active : t.suspended}
                  </span>
                  <form action={setReaderActive.bind(null, reader.id, !reader.active)}>
                    <button className={smallButton}>{reader.active ? t.suspend : t.reactivate}</button>
                  </form>
                </div>
              </div>

              {reader.active && <ResendWelcome email={reader.email} name={reader.name} lang={lang} dict={t} />}

              <div className="flex flex-wrap gap-2">
                {books.map((book) => {
                  const link = reader.books.find((b) => b.slug === book.slug);
                  const linked = link?.active === true;
                  return (
                    <form key={book.slug} action={setEntitlement.bind(null, reader.id, book.slug, !linked)}>
                      <button
                        aria-pressed={linked}
                        className={`${smallButton} aria-pressed:border-accent aria-pressed:text-accent`}
                        title={linked ? t.unlink : t.link}
                      >
                        {linked ? "✓ " : "+ "}
                        {book.title}
                        {link?.source === "salla" ? ` · ${t.fromSalla}` : ""}
                      </button>
                    </form>
                  );
                })}
              </div>

              {reader.books.some((book) => book.active) && (
                <ul className="flex flex-col gap-2">
                  {reader.books
                    .filter((book) => book.active)
                    .map((book) => {
                      const bookProgress = progress?.[reader.id]?.[book.slug];
                      return (
                        <li key={book.slug} className="flex flex-col gap-1">
                          <span className="text-sm">{book.title}</span>
                          <ProgressLine progress={bookProgress} updatedAt={bookProgress?.updatedAt} labels={t.follow} />
                        </li>
                      );
                    })}
                </ul>
              )}
              <Link href={`/${lang}/admin/readers/${reader.id}`} className="self-start text-xs text-accent hover:underline">
                {t.follow.open}
              </Link>

              {reader.books
                .filter((book) => book.active)
                .map((book) => (
                  <ChapterOverrides key={book.slug} readerId={reader.id} book={book} labels={t.overrides} />
                ))}

              <div className="flex flex-col gap-1 text-sm">
                <p className="text-muted">
                  {t.devices}
                  {reader.last_read_at && ` · ${t.lastRead} ${when.format(new Date(reader.last_read_at))}`}
                </p>
                {reader.devices.length === 0 && <p className="text-muted">{t.noDevices}</p>}
                {reader.devices.map((device) => (
                  <div key={device.id} className="flex flex-wrap items-center gap-2">
                    <code dir="ltr" className="text-xs">
                      {device.id.slice(0, 8)}
                    </code>
                    <span className="text-muted">{when.format(new Date(device.last_seen))}</span>
                    {device.revoked ? (
                      <span className="text-muted">{t.removed}</span>
                    ) : (
                      <form action={revokeDevice.bind(null, reader.id, device.id)}>
                        <button className={smallButton}>{t.removeDevice}</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data.invites && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">{t.invites}</h2>
          {data.invites.length === 0 && <p className="text-muted">{t.noInvites}</p>}
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.invites.map((invite) => (
              <li key={invite.email} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <span className="font-medium">{invite.name || invite.email}</span>
                    <span dir="ltr" className="text-start text-xs text-muted">
                      {invite.email}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {t.invitedAt} {when.format(new Date(invite.created_at))}
                  </span>
                </div>
                {invite.books.length > 0 && <p className="text-xs text-muted">{invite.books.join(" · ")}</p>}
                <ResendWelcome email={invite.email} name={invite.name} lang={lang} dict={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.salla.title}</h2>
        <p className="leading-relaxed text-muted">{t.salla.lead}</p>
        <p className="text-sm">
          {t.salla.webhook}{" "}
          <code dir="ltr" className="break-all">
            {webhookUrl}
          </code>
        </p>
        <form action={setSallaProduct} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm">{t.salla.sku}</span>
            <input name="sku" dir="ltr" required className="rounded-xl border border-border bg-background px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm">{t.book}</span>
            <select name="book" required className="rounded-xl border border-border bg-background px-3 py-2.5">
              {books.map((book) => (
                <option key={book.slug} value={book.slug}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>
          <button disabled={books.length === 0} className="rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground disabled:opacity-60">
            {t.salla.save}
          </button>
        </form>
        <p className="text-sm text-muted">{t.salla.products}</p>
        {salla.products.length === 0 && <p className="text-sm text-muted">{t.salla.noProducts}</p>}
        <ul className="flex flex-wrap gap-2">
          {salla.products.map((product) => (
            <li key={product.sku} className="rounded-full border border-border px-3 py-1 text-sm">
              <code dir="ltr">{product.sku}</code> → {product.title}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t.salla.events}</p>
        {salla.events.length === 0 && <p className="text-sm text-muted">{t.salla.noEvents}</p>}
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {salla.events.map((event, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm" dir="ltr">
              <span>
                {event.event} #{event.order_id ?? "-"} {event.status ?? ""}
              </span>
              <span>{event.email ?? "-"}</span>
              <span className="font-medium">{event.outcome}</span>
              <span className="text-muted">{when.format(new Date(event.received_at))}</span>
            </li>
          ))}
        </ul>
      </section>

      <TestResultsSection tests={tests} readers={readers} lang={lang} dict={dict} when={when} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.recentReads}</h2>
        {reads.length === 0 && <p className="text-muted">{t.noReads}</p>}
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {reads.map((read, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
              <span dir="ltr">{read.email}</span>
              <span>
                {read.book} · {read.chapter}
              </span>
              <span className="text-muted">{when.format(new Date(read.opened_at))}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function TestResultsSection({
  tests,
  readers,
  lang,
  dict,
  when,
}: {
  tests: TestResultRow[];
  readers: Dashboard["readers"];
  lang: Locale;
  dict: Dictionary;
  when: Intl.DateTimeFormat;
}) {
  const t = dict.admin;
  const emails = new Map(readers.map((reader) => [reader.id, reader.email]));
  const statusLabel = (status: string | null | undefined) =>
    status === "done" || status === "expired" || status === "open" ? t.testStatus[status] : "-";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.testResults}</h2>
        <Link
          href={`/${lang}/admin/test`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-heading text-sm text-accent-foreground"
        >
          <ClipboardCheck size={16} aria-hidden />
          {t.openTestResults}
        </Link>
      </div>
      {tests.length === 0 && <p className="text-muted">{t.noTestResults}</p>}
      {tests.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {tests.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{row.name || "-"}</span>
                <span dir="ltr" className="truncate text-start text-xs text-muted">
                  {(row.user_id && emails.get(row.user_id)) || row.key}
                </span>
              </span>
              <span>{statusLabel(row.status)}</span>
              <span className="text-muted">{when.format(new Date(row.updated_at))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
