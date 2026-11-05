import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { AdminView, type Dashboard, type SallaPanel, type TestResultRow } from "./admin-view";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.title };
}

export default async function AdminPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-8 py-6">
        <h1 className="font-heading text-3xl font-bold">{dict.admin.title}</h1>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Panel lang={lang} dict={dict} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} path="/admin" />
    </div>
  );
}

async function Panel({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const [dashboard, salla, tests] = await Promise.all([
    supabase.rpc("admin_dashboard"),
    supabase.rpc("admin_salla"),
    supabase
      .from("test_results")
      .select("key, user_id, status:answers->>status, name:answers->>name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);
  if (dashboard.error || salla.error) return <p role="alert">{dict.errors.generic}</p>;

  const host = (await headers()).get("host");
  const webhookUrl = host ? `https://${host}/api/salla/webhook` : "/api/salla/webhook";
  return (
    <AdminView
      data={dashboard.data as Dashboard}
      salla={salla.data as SallaPanel}
      tests={tests.error ? [] : (tests.data as TestResultRow[])}
      webhookUrl={webhookUrl}
      lang={lang}
      dict={dict}
    />
  );
}
