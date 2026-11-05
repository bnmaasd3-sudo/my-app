import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { latest, matchesSearch } from "@/lib/reader-progress";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { AdminView, type Dashboard, type SallaPanel, type TestResultRow } from "./admin-view";
import { loadProgress, ownerService } from "./reader-data";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.admin.title };
}

export default async function AdminPage({ searchParams }: PageProps<"/[lang]/admin">) {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-8 py-6">
        <h1 className="font-heading text-3xl font-bold">{dict.admin.title}</h1>
        <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
          <Panel lang={lang} dict={dict} searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} path="/admin" />
    </div>
  );
}

async function Panel({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").slice(0, 100);
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

  // The readers the owner searched for, most recently active first.
  const data = dashboard.data as Dashboard;
  const activity = (reader: Dashboard["readers"][number]) =>
    latest(reader.last_read_at, reader.last_sign_in_at, reader.created_at) ?? "";
  const readers = data.readers
    .filter((reader) => matchesSearch(reader, query))
    .sort((a, b) => activity(b).localeCompare(activity(a)));

  // Where each reader is in each book: read with the service key (owner only).
  const owner = await ownerService();
  const progress = "service" in owner ? await loadProgress(owner.service, readers.map((reader) => reader.id)) : null;

  const host = (await headers()).get("host");
  const webhookUrl = host ? `https://${host}/api/salla/webhook` : "/api/salla/webhook";
  return (
    <AdminView
      data={{ ...data, readers }}
      progress={progress}
      query={query}
      salla={salla.data as SallaPanel}
      tests={tests.error ? [] : (tests.data as TestResultRow[])}
      webhookUrl={webhookUrl}
      lang={lang}
      dict={dict}
    />
  );
}
