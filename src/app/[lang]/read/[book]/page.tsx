import { BookOpen, ListOrdered } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../reader-error";
import { SiteHeader } from "../../site-header";
import { ChapterList } from "../chapter-list";

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

  const first = contents.position ?? 1;

  return (
    <>
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ListOrdered size={18} aria-hidden />
          </span>
          {dict.library.contents}
        </div>
        <h1 lang={bookLang} dir={dir(bookLang)} className="font-heading text-2xl leading-snug font-bold sm:text-3xl">
          {contents.book.title}
        </h1>
        <Link
          prefetch={false}
          href={`/${lang}/read/${contents.book.slug}/${first}`}
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground transition-opacity hover:opacity-90"
        >
          <BookOpen size={18} aria-hidden />
          {contents.position ? dict.library.continue : dict.library.start}
        </Link>
      </div>
      <ChapterList
        chapters={contents.chapters}
        base={`/${lang}/read/${contents.book.slug}`}
        bookLang={bookLang}
        lang={lang}
        marked={contents.position}
        badge={dict.reader.lastPosition}
        variant="page"
      />
    </>
  );
}
