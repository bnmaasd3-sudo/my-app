import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { readerErrorKind } from "@/lib/reader-errors";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../reader-error";
import { SiteHeader } from "../site-header";

type LibraryBook = {
  slug: string;
  title: string;
  lang: Locale;
  position: number | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.library.title };
}

export default async function LibraryPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/library" signedIn />
      <main className="flex flex-1 flex-col gap-6 py-6">
        <h1 className="font-heading text-3xl font-bold">{dict.library.title}</h1>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Books lang={lang} dict={dict} />
        </Suspense>
      </main>
    </div>
  );
}

async function Books({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_library");
  if (error) return <ReaderError kind={readerErrorKind(error)} lang={lang} dict={dict} />;

  const books = (data ?? []) as LibraryBook[];
  if (books.length === 0) return <p className="leading-relaxed text-muted">{dict.library.empty}</p>;

  return (
    <ul className="grid gap-4">
      {books.map((book) => (
        <li
          key={book.slug}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 lang={book.lang} className="font-heading text-xl font-semibold">
            {book.title}
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              prefetch={false}
              href={`/${lang}/read/${book.slug}/${book.position ?? 1}`}
              className="rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground"
            >
              {book.position ? dict.library.continue : dict.library.start}
            </Link>
            <Link
              href={`/${lang}/read/${book.slug}`}
              className="rounded-full border border-border px-5 py-2.5"
            >
              {dict.library.contents}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
