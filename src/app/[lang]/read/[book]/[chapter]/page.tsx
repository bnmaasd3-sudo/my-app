import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { figurePaths } from "@/lib/book-text";
import { DEVICE_COOKIE } from "@/lib/device";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../../reader-error";
import { ChapterView, type OpenedChapter, type ReaderPrefs } from "../../chapter-view";

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

  return (
    <ChapterView
      lang={lang}
      dict={dict}
      data={data}
      chapters={chapters}
      figures={figures}
      prefs={prefs.data as ReaderPrefs}
    />
  );
}
