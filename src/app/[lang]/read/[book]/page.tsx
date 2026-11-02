import Link from "next/link";
import { Suspense } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../reader-error";
import { SiteHeader } from "../../site-header";

type Contents = {
  book: { slug: string; title: string; lang: string };
  chapters: { position: number; title: string }[];
  position: number | null;
};

export default async function ContentsPage({ params }: PageProps<"/[lang]/read/[book]">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/library" signedIn />
      <main className="flex flex-1 flex-col gap-6 py-6">
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Chapters params={params} lang={lang} dict={dict} />
        </Suspense>
      </main>
    </div>
  );
}

async function Chapters({
  params,
  lang,
  dict,
}: {
  params: Promise<{ book: string }>;
  lang: Locale;
  dict: Dictionary;
}) {
  const { book } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_toc", { p_book_slug: book });
  if (error) return <ReaderError kind={readerErrorKind(error)} lang={lang} dict={dict} />;

  const contents = data as Contents;
  const bookLang = hasLocale(contents.book.lang) ? contents.book.lang : lang;

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">{dict.library.contents}</p>
        <h1 lang={bookLang} className="font-heading text-3xl font-bold">
          {contents.book.title}
        </h1>
      </div>
      <ol lang={bookLang} dir={dir(bookLang)} className="flex flex-col gap-2">
        {contents.chapters.map((chapter) => {
          const current = chapter.position === contents.position;
          return (
            <li key={chapter.position}>
              <Link
                prefetch={false}
                href={`/${lang}/read/${contents.book.slug}/${chapter.position}`}
                aria-current={current ? "page" : undefined}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 aria-[current=page]:border-accent"
              >
                <span>{chapter.title}</span>
                {current && (
                  <span lang={lang} className="shrink-0 text-xs text-accent">
                    {dict.reader.current}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
