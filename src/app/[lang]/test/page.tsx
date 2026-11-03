import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { ReaderError } from "../reader-error";
import { TestEngineHost } from "./test-engine-host";
import { TestFrame } from "./test-view";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.test.title };
}

/** The type test, for signed-in readers. Each account keeps one attempt. */
export default async function TestPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <TestFrame lang={lang} dict={dict}>
      <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
        <ReaderTest lang={lang} dict={dict} />
      </Suspense>
    </TestFrame>
  );
}

async function ReaderTest({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/${lang}/login`);
  const { data: allowed } = await supabase.rpc("can_take_test");
  if (allowed !== true) return <ReaderError kind="inactive" lang={lang} dict={dict} />;
  return <TestEngineHost userId={userId} isOwner={false} labels={dict.test} />;
}
