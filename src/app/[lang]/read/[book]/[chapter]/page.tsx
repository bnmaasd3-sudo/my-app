import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { figurePaths } from "@/lib/book-text";
import { DEVICE_COOKIE } from "@/lib/device";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../../reader-error";
import { BookMarkdown } from "../../book-markdown";
import { ChapterList } from "../../chapter-list";
import { ReaderFrame, type FontSize, type Layout, type Theme } from "../../reader-frame";
import { ReaderSignature } from "../../reader-signature";

type OpenedChapter = {
  book: { slug: string; title: string; lang: string };
  chapter: { position: number; title: string; body: string };
  total: number;
  scroll_ratio: number;
  reader: { name: string; email: string };
};

export default async function ChapterPage({
  params,
}: PageProps<"/[lang]/read/[book]/[chapter]">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-5 py-10 text-muted">{dict.common.loading}</p>}
    >
      <Chapter params={params} lang={lang} dict={dict} />
    </Suspense>
  );
}

async function Chapter({
  params,
  lang,
  dict,
}: {
  params: Promise<{ book: string; chapter: string }>;
  lang: Locale;
  dict: Dictionary;
}) {
  const { book, chapter } = await params;
  const position = Number(chapter);
  if (!/^\d{1,5}$/.test(chapter) || position < 1) notFound();

  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  const supabase = await createClient();
  const [opened, prefs, toc] = await Promise.all([
    supabase.rpc("open_chapter", {
      p_book_slug: book,
      p_position: position,
      p_device_id: deviceId,
    }),
    supabase.from("reader_prefs").select("font_size, theme, layout").maybeSingle(),
    supabase.rpc("book_toc", { p_book_slug: book }),
  ]);

  if (opened.error) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <ReaderError kind={readerErrorKind(opened.error)} lang={lang} dict={dict} />
      </main>
    );
  }

  const data = opened.data as OpenedChapter;

  // Short-lived links to this chapter's figures; storage checks the reader owns the book.
  const figures: Record<string, string> = {};
  const paths = figurePaths(data.chapter.body, data.book.slug);
  if (paths.length > 0) {
    const signed = await supabase.storage.from("figures").createSignedUrls(paths, 600);
    for (const item of signed.data ?? []) {
      const name = item.path?.split("/").pop();
      if (name && item.signedUrl) figures[name] = item.signedUrl;
    }
  }

  const chapters = toc.error ? [] : ((toc.data as { chapters: { position: number; title: string }[] }).chapters ?? []);
  const bookLang = hasLocale(data.book.lang) ? data.book.lang : lang;
  const base = `/${lang}/read/${data.book.slug}`;

  const previousHref = data.chapter.position > 1 ? `${base}/${data.chapter.position - 1}` : null;
  const nextHref = data.chapter.position < data.total ? `${base}/${data.chapter.position + 1}` : null;

  return (
    <ReaderFrame
      bookSlug={data.book.slug}
      bookLang={bookLang}
      bookDir={dir(bookLang)}
      chapterTitle={data.chapter.title}
      position={data.chapter.position}
      total={data.total}
      initialRatio={data.scroll_ratio}
      initialFontSize={(prefs.data?.font_size as FontSize) ?? "md"}
      initialTheme={(prefs.data?.theme as Theme) ?? "system"}
      initialLayout={(prefs.data?.layout as Layout) ?? "auto"}
      labels={dict.reader}
      backHref={base}
      previousHref={previousHref}
      nextHref={nextHref}
      contents={
        <nav aria-label={dict.reader.contents}>
          <p lang={bookLang} dir={dir(bookLang)} className="mb-3 px-2.5 font-heading text-sm font-semibold">
            {data.book.title}
          </p>
          <ChapterList
            chapters={chapters}
            base={base}
            bookLang={bookLang}
            lang={lang}
            marked={data.chapter.position}
            badge={dict.reader.reading}
            variant="compact"
          />
        </nav>
      }
    >
      <article lang={bookLang} dir={dir(bookLang)} className="reader-text pt-10 pb-6 select-none">
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 font-heading text-sm text-accent">{data.book.title}</p>
          <h1 className="font-heading text-[1.45em] leading-snug font-bold">{data.chapter.title}</h1>
        </header>
        <BookMarkdown body={data.chapter.body} figures={figures} />
      </article>

      <nav className="grid grid-cols-2 gap-3 pb-10">
        {previousHref ? (
          <Link
            prefetch={false}
            href={previousHref}
            className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface"
          >
            <ChevronLeft size={18} aria-hidden className="shrink-0 rtl:-scale-x-100" />
            {dict.reader.previous}
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link
            prefetch={false}
            href={nextHref}
            className="flex items-center justify-end gap-2 rounded-2xl bg-accent px-4 py-3 font-heading text-accent-foreground transition-opacity hover:opacity-90"
          >
            {dict.reader.next}
            <ChevronRight size={18} aria-hidden className="shrink-0 rtl:-scale-x-100" />
          </Link>
        ) : (
          <span className="flex items-center justify-end rounded-2xl border border-dashed border-border px-4 py-3 text-muted">
            {dict.reader.endOfBook}
          </span>
        )}
      </nav>

      <ReaderSignature
        label={dict.reader.licensedTo}
        name={data.reader.name}
        email={data.reader.email}
      />
    </ReaderFrame>
  );
}
