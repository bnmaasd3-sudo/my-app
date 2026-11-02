import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "../site-header";
import { AdminView, type Dashboard } from "./admin-view";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.title };
}

export default async function AdminPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/admin" signedIn />
      <main className="flex flex-1 flex-col gap-8 py-6">
        <h1 className="font-heading text-3xl font-bold">{dict.admin.title}</h1>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Panel lang={lang} dict={dict} />
        </Suspense>
      </main>
    </div>
  );
}

async function Panel({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const { data, error } = await supabase.rpc("admin_dashboard");
  if (error) return <p role="alert">{dict.errors.generic}</p>;
  return <AdminView data={data as Dashboard} lang={lang} dict={dict} />;
}
