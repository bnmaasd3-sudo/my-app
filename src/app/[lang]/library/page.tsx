import type { Metadata } from "next";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../reader-error";
import { LibraryFrame, LibraryShelves, type LibraryBook } from "./library-view";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.library.title };
}

export default async function LibraryPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <LibraryFrame lang={lang} dict={dict}>
      <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
        <Shelves lang={lang} dict={dict} />
      </Suspense>
    </LibraryFrame>
  );
}

async function Shelves({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const [{ data, error }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("my_library"),
    supabase.rpc("is_admin"),
  ]);

  const owner = isAdmin === true;
  if (error && !owner) return <ReaderError kind={readerErrorKind(error)} lang={lang} dict={dict} />;

  return (
    <LibraryShelves
      lang={lang}
      dict={dict}
      books={error ? null : ((data ?? []) as LibraryBook[])}
      isAdmin={owner}
    />
  );
}
