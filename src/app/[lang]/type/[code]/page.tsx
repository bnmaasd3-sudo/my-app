import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import type { LibraryBook } from "../../library/library-view";
import { ReaderError } from "../../reader-error";
import { TypeView } from "../type-view";

export async function generateMetadata({ params }: PageProps<"/[lang]/type/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: decodeURIComponent(code) };
}

/** One type's page: the reader's books of that type, and the test. */
export default async function TypePage({ params }: PageProps<"/[lang]/type/[code]">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-5 py-10 text-muted">{dict.common.loading}</p>}>
      <TypeBooks params={params} lang={lang} dict={dict} />
    </Suspense>
  );
}

async function TypeBooks({
  params,
  lang,
  dict,
}: {
  params: Promise<{ code: string }>;
  lang: Locale;
  dict: Dictionary;
}) {
  const code = decodeURIComponent((await params).code);
  if (!/^[A-Z]{4}(-[A-Z]){0,2}$/.test(code)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_library");
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <ReaderError kind={readerErrorKind(error)} lang={lang} dict={dict} />
      </main>
    );
  }
  // Only the books the reader owns come back; a type they own nothing of does not exist for them.
  const books = ((data ?? []) as LibraryBook[]).filter((book) => book.type_code === code);
  if (books.length === 0) notFound();
  return <TypeView code={code} books={books} lang={lang} dict={dict} />;
}
