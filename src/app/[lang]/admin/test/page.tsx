import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "../../site-header";
import { TestEngineHost } from "../../test/test-engine-host";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.testResults };
}

/** The owner's side of the type test: every result, its detail, trials and the path choice. */
export default async function AdminTestPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/admin/test" signedIn />
      <main className="flex flex-1 flex-col gap-4 py-6">
        <Link
          href={`/${lang}/admin`}
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden className="rtl:-scale-x-100" />
          {dict.admin.backToAdmin}
        </Link>
        <h1 className="font-heading text-3xl font-bold">{dict.admin.testResults}</h1>
        <p className="leading-relaxed text-muted">{dict.admin.testPanelLead}</p>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <OwnerTest lang={lang} dict={dict} />
        </Suspense>
      </main>
    </div>
  );
}

async function OwnerTest({ dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const [{ data: isAdmin }, { data: claims }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.auth.getClaims(),
  ]);
  const userId = claims?.claims?.sub;
  if (isAdmin !== true || !userId) notFound();
  return <TestEngineHost userId={userId} isOwner labels={dict.test} />;
}
