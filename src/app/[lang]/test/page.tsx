import { ArrowLeft, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { SiteHeader } from "../site-header";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.test.title };
}

/** The type test. Its questions come later from the project's files. */
export default async function TestPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/test" signedIn />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <span className="inline-flex size-20 items-center justify-center rounded-3xl bg-accent/10 text-accent">
          <ClipboardCheck size={40} strokeWidth={1.5} aria-hidden />
        </span>
        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm text-accent">{dict.test.soonTitle}</p>
          <h1 className="font-heading text-3xl font-bold">{dict.test.title}</h1>
          <p className="max-w-md leading-loose text-muted">{dict.test.soonBody}</p>
        </div>
        <Link
          href={`/${lang}/library`}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 transition-colors hover:bg-surface"
        >
          <ArrowLeft size={16} aria-hidden className="rtl:-scale-x-100" />
          {dict.test.back}
        </Link>
      </main>
    </div>
  );
}
