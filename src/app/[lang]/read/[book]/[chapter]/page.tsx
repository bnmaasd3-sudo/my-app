import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { toBlocks } from "@/lib/book-text";
import { DEVICE_COOKIE } from "@/lib/device";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../../reader-error";
import { ReaderFrame, type FontSize, type Theme } from "../../reader-frame";
import { Watermark } from "../../watermark";

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
  const [opened, prefs] = await Promise.all([
    supabase.rpc("open_chapter", {
      p_book_slug: book,
      p_position: position,
      p_device_id: deviceId,
    }),
    supabase.from("reader_prefs").select("font_size, theme").maybeSingle(),
  ]);

  if (opened.error) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <ReaderError kind={readerErrorKind(opened.error)} lang={lang} dict={dict} />
      </main>
    );
  }

  const data = opened.data as OpenedChapter;
  const bookLang = hasLocale(data.book.lang) ? data.book.lang : lang;
  const base = `/${lang}/read/${data.book.slug}`;

  return (
    <ReaderFrame
      bookSlug={data.book.slug}
      position={data.chapter.position}
      initialRatio={data.scroll_ratio}
      initialFontSize={(prefs.data?.font_size as FontSize) ?? "md"}
      initialTheme={(prefs.data?.theme as Theme) ?? "system"}
      labels={dict.reader}
      header={
        <Link href={base} className="truncate font-heading text-sm text-accent">
          {dict.reader.contents}
        </Link>
      }
    >
      <article
        lang={bookLang}
        dir={dir(bookLang)}
        className="reader-text mx-auto max-w-2xl px-5 py-8 select-none"
      >
        <p className="mb-2 font-heading text-sm text-muted">{data.book.title}</p>
        <h1 className="mb-8 font-heading text-[1.4em] leading-snug font-bold">
          {data.chapter.title}
        </h1>
        {toBlocks(data.chapter.body).map((block, index) =>
          block.kind === "heading" ? (
            <h2 key={index} className="mt-8 mb-4 font-heading text-[1.15em] font-semibold">
              {block.text}
            </h2>
          ) : (
            <p key={index} className="mb-5 whitespace-pre-line">
              {block.text}
            </p>
          ),
        )}
      </article>

      <nav className="mx-auto flex max-w-2xl justify-between gap-3 px-5 pb-16">
        {data.chapter.position > 1 ? (
          <Link
            prefetch={false}
            href={`${base}/${data.chapter.position - 1}`}
            className="rounded-full border border-border px-5 py-2.5"
          >
            {dict.reader.previous}
          </Link>
        ) : (
          <span />
        )}
        {data.chapter.position < data.total && (
          <Link
            prefetch={false}
            href={`${base}/${data.chapter.position + 1}`}
            className="rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground"
          >
            {dict.reader.next}
          </Link>
        )}
      </nav>

      <Watermark name={data.reader.name} email={data.reader.email} />
    </ReaderFrame>
  );
}
