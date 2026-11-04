import type { Metadata } from "next";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { LegalPage } from "../legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.legal.privacyTitle };
}

export default async function Page() {
  const lang = await currentLocale();
  return <LegalPage lang={lang} dict={await getDictionary(lang)} kind="privacy" />;
}
