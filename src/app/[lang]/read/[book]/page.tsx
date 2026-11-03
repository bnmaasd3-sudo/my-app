import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../../reader-error";
import { ContentsFrame, ContentsView, type Contents } from "./contents-view";

export default async function ContentsPage({ params }: PageProps<"/[lang]/read/[book]">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <ContentsFrame lang={lang} dict={dict}>
      <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
        <Chapters params={params} lang={lang} dict={dict} />
      </Suspense>
    </ContentsFrame>
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
  return <ContentsView lang={lang} dict={dict} contents={data as Contents} />;
}
