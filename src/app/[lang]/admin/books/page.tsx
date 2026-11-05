import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "../../site-footer";
import { SiteHeader } from "../../site-header";
import { BookImport, type ExistingBook } from "./book-import";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.bookImport.title };
}

/** The owner adds or updates a book and its figures here, without a script. */
export default async function AdminBooksPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-6 pt-6 pb-14">
        <Link href={`/${lang}/admin`} className="self-start text-sm text-muted hover:text-foreground">
          {dict.admin.backToAdmin}
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold">{dict.admin.bookImport.title}</h1>
          <p className="text-muted">{dict.admin.bookImport.lead}</p>
        </div>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <OwnerBooks lang={lang} dict={dict} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} path="/admin/books" />
    </div>
  );
}

async function OwnerBooks({ dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  // Books and chapters are closed to every account, so the owner's list comes
  // through the service key, after the is_admin check above.
  const service = createServiceClient();
  if (!service) return <p className="text-accent">{dict.admin.bookImport.errors.noServiceKey}</p>;
  const { data } = await service
    .from("books")
    .select("slug, title, lang, type_code, kind, chapters(count)")
    .order("title");
  const books: ExistingBook[] = (data ?? []).map((book) => ({
    slug: book.slug,
    title: book.title,
    lang: book.lang,
    typeCode: book.type_code,
    kind: book.kind,
    chapters: (book.chapters as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return <BookImport books={books} labels={dict.admin.bookImport} kinds={dict.library.kinds} />;
}
