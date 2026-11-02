import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { revokeDevice, setEntitlement, setReaderActive } from "./actions";
import { AddReaderForm } from "./add-reader-form";

export type Dashboard = {
  books: { slug: string; title: string; chapters: number; readers: number }[];
  readers: {
    id: string;
    email: string;
    name: string | null;
    active: boolean;
    books: { slug: string; title: string; active: boolean; source: string }[];
    devices: { id: string; last_seen: string; revoked: boolean }[];
    last_read_at: string | null;
  }[];
  reads: { email: string; book: string; chapter: string; opened_at: string }[];
};

const smallButton = "rounded-full border border-border px-3 py-1 text-xs hover:bg-background";

export function AdminView({ data, lang, dict }: { data: Dashboard; lang: Locale; dict: Dictionary }) {
  const { books, readers, reads } = data;

  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  });
  const t = dict.admin;

  return (
    <>
      <AddReaderForm books={books} dict={t} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.books}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {books.map((book) => (
            <li key={book.slug} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="font-heading">{book.title}</p>
              <p className="text-sm text-muted" dir="ltr">
                {book.slug} · {t.chaptersCount.replace("{n}", String(book.chapters))} ·{" "}
                {t.readersCount.replace("{n}", String(book.readers))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t.readers}</h2>
        {readers.length === 0 && <p className="text-muted">{t.noReaders}</p>}
        <ul className="flex flex-col gap-3">
          {readers.map((reader) => (
            <li key={reader.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-heading">{reader.name || reader.email}</p>
                  <p className="text-sm text-muted" dir="ltr">
                    {reader.email}
                  </p>
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
